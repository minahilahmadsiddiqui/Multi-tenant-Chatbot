import "server-only";
import { env } from "../env";
import { getEmbeddings } from "./embeddings";
import { generateAnswer, UNKNOWN_POLICY_PHRASE, type ContextChunk } from "./generate";
import { getQdrant, type ScoredPoint } from "./qdrant";
import { countTokens, truncateTextToTokenBudget } from "./textSplitter";
import { isChatProvider, DEFAULT_CHAT_MODEL } from "../../modelCatalog";

export const FALLBACK_PHRASE = UNKNOWN_POLICY_PHRASE;
const HANDBOOK_ASSISTANT_GREETING =
  "Hello! I can help you find information in the uploaded document/documents. What would you like to know?";

export interface RagResult {
  answer: string;
  fallback_used: boolean;
  retrieved: Array<Record<string, unknown>>;
  citations: Array<Record<string, unknown>>;
  latency_ms: number;
  top_k: number;
  threshold: number;
  retrieval_diagnostics: Record<string, unknown>;
  sentence_evidence: unknown[];
  ab_variant: string;
  rag_retrieval_ran: boolean;
  pipeline: string;
}

function pipelineFields(ragRetrievalRan: boolean, pipeline: string) {
  return { rag_retrieval_ran: ragRetrievalRan, pipeline };
}

function sanitizeQuery(query: string): string {
  let q = (query || "").trim();
  if (q.length > 4000) q = q.slice(0, 4000);
  return q;
}

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

function isObviousGibberishQuery(query: string): boolean {
  const raw = (query || "").trim();
  if (!raw) return false;
  const letters = raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (!letters) return raw.replace(/\s+/g, "").length >= 4;
  if (letters.length >= 4 && ![...letters].some((c) => VOWELS.has(c))) return true;
  if (letters.length >= 12) {
    const ratio = [...letters].filter((c) => VOWELS.has(c)).length / Math.max(letters.length, 1);
    if (ratio < 0.1) return true;
  }
  for (const tk of raw.match(/[a-zA-Z]+/g) || []) {
    const tkl = tk.toLowerCase();
    if (tkl.length >= 4 && ![...tkl].some((c) => VOWELS.has(c))) return true;
  }
  if (/(.)\1{4,}/.test(letters)) return true;
  return false;
}

// difflib.SequenceMatcher.ratio() equivalent (Ratcliff/Obershelp).
function seqRatio(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const matches = matchingBlocksLength(a, b);
  return (2.0 * matches) / (a.length + b.length);
}

function matchingBlocksLength(a: string, b: string): number {
  // Recursive longest-matching-block sum, mirroring difflib.
  let total = 0;
  const stack: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
  while (stack.length) {
    const [alo, ahi, blo, bhi] = stack.pop()!;
    const [i, j, k] = findLongestMatch(a, alo, ahi, b, blo, bhi);
    if (k > 0) {
      total += k;
      if (alo < i && blo < j) stack.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) stack.push([i + k, ahi, j + k, bhi]);
    }
  }
  return total;
}

function findLongestMatch(
  a: string,
  alo: number,
  ahi: number,
  b: string,
  blo: number,
  bhi: number
): [number, number, number] {
  const b2j = new Map<string, number[]>();
  for (let j = blo; j < bhi; j++) {
    const ch = b[j];
    if (!b2j.has(ch)) b2j.set(ch, []);
    b2j.get(ch)!.push(j);
  }
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  let j2len = new Map<number, number>();
  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map<number, number>();
    for (const j of b2j.get(a[i]) || []) {
      const k = (j2len.get(j - 1) || 0) + 1;
      newj2len.set(j, k);
      if (k > bestsize) {
        besti = i - k + 1;
        bestj = j - k + 1;
        bestsize = k;
      }
    }
    j2len = newj2len;
  }
  return [besti, bestj, bestsize];
}

function isGreeting(query: string): boolean {
  const q = (query || "").toLowerCase().trim();
  let qn = q.replace(/[^a-z0-9\s]/g, "");
  qn = qn.replace(/\s+/g, " ").trim();
  if (/^(hi|hello|hey)(\s+(there|team|all|everyone))?$/.test(qn)) return true;
  if (/\b(?:how|hoe|hui)\s*(are|re|r)\s*(you|u)\b/.test(qn)) return true;
  if (/\bhow\s*(are|re|r)\s*(you|u)\b/.test(qn)) return true;
  if (seqRatio(qn, "how are you") >= 0.74) return true;
  if (/\b(i['?]?m|i am)\s+(fine|good|well|okay|ok)\b/.test(q)) return true;
  return false;
}

function greetingAnswer(query: string): string {
  const q = (query || "").toLowerCase().replace(/\s+/g, " ").trim();
  let qn = q.replace(/[^a-z0-9\s]/g, "");
  qn = qn.replace(/\s+/g, " ").trim();
  if (qn === "how are you") return "I am doing well, thank you. How can I help you?";
  if (/\b(?:how|hoe|hui)\s*(are|re|r)\s*(you|u)\b/.test(qn))
    return 'I\'m good, looks like you meant "How are you?" How can I help you?';
  if (seqRatio(qn, "how are you") >= 0.74)
    return 'I\'m good, looks like you meant "How are you?" How can I help you?';
  if (/\b(i['?]?m|i am)\s+(fine|good|well|okay|ok)\b/.test(q))
    return "Glad to hear it. What can I help you find in the uploaded document/documents?";
  return HANDBOOK_ASSISTANT_GREETING;
}

function textPreview(text: string, maxChars = 250): string {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).replace(/\s+$/, "") + "...";
}

interface RetrievedItem {
  score: number | null;
  payload: Record<string, unknown>;
}

function buildContext(retrieved: RetrievedItem[], maxContextTokens: number): Array<Record<string, unknown>> {
  const context: Array<Record<string, unknown>> = [];
  let running = 0;
  for (const r of retrieved) {
    const payload = r.payload || {};
    const text = String(payload.text || "").trim();
    if (!text) continue;
    let tok: number;
    const rawTok = payload.token_count;
    try {
      tok = rawTok != null ? parseInt(String(rawTok), 10) : countTokens(text);
      if (!Number.isFinite(tok)) tok = countTokens(text);
    } catch {
      tok = countTokens(text);
    }
    const room = maxContextTokens - running;
    if (room <= 0) break;
    let useText = text;
    let useTok = tok;
    if (useTok > room) {
      useText = truncateTextToTokenBudget(text, room);
      useTok = countTokens(useText);
      if (useTok <= 0) continue;
    }
    context.push({
      text: useText,
      doc_id: payload.doc_id,
      chunk_id: payload.chunk_id,
      chunk_index: payload.chunk_index,
      source_section: payload.source_section,
      page_number: payload.page_number,
      token_count: useTok,
      score: r.score,
    });
    running += useTok;
  }
  return context;
}

function citationEntry(chunk: Record<string, unknown>): Record<string, unknown> {
  return {
    doc_id: chunk.doc_id,
    chunk_index: chunk.chunk_index,
    chunk_id: chunk.chunk_id,
    text_preview: textPreview(String(chunk.text || "")),
    token_count: chunk.token_count,
  };
}

const WEAK_TERMS = new Set([
  "what", "when", "where", "which", "who", "whom", "whose", "how",
  "many", "much", "more", "most", "some", "any", "about",
  "allowed", "allow", "policy",
  "are", "is", "was", "were", "be", "been", "being",
  "the", "a", "an", "for", "with", "into", "from", "that", "this",
  "your", "their", "once", "during", "shall",
]);

function extractiveAnswerFromContext(
  question: string,
  contextChunks: Array<Record<string, unknown>>,
  maxSentences = 4
): [string, Array<Record<string, unknown>>] {
  let qTerms = new Set((question || "").toLowerCase().match(/[a-zA-Z0-9]+/g)?.filter((w) => w.length > 2) || []);
  qTerms = new Set([...qTerms].filter((w) => !WEAK_TERMS.has(w)));
  const sentences: string[] = [];
  const used: Array<Record<string, unknown>> = [];
  for (const c of contextChunks) {
    const text = String(c.text || "");
    if (!text) continue;
    const normalizedText = text.replace(/[•·▪◦\ufffd]/g, "\n");
    let matchedHere = false;
    for (const line of normalizedText.split(/\n+/)) {
      for (const seg of line.split(/(?<=[.!?])\s+/)) {
        const s = seg.trim();
        if (s.length < 20) continue;
        if (qTerms.size) {
          const sTerms = new Set(s.toLowerCase().match(/[a-zA-Z0-9]+/g)?.filter((w) => w.length > 2) || []);
          if (![...qTerms].some((w) => sTerms.has(w))) continue;
        }
        sentences.push(s);
        matchedHere = true;
        if (maxSentences > 0 && sentences.length >= maxSentences) break;
      }
      if (maxSentences > 0 && sentences.length >= maxSentences) break;
    }
    if (matchedHere) used.push(c);
    if (maxSentences > 0 && sentences.length >= maxSentences) break;
  }
  if (!sentences.length) return ["", []];
  let answer = sentences.join(" ").trim();
  if (answer && !answer.endsWith(".")) answer += ".";
  return [answer, used];
}

function denseRelevanceDiagnostics(selected: RetrievedItem[], threshold: number): Record<string, unknown> {
  const topDense = selected.length ? Number(selected[0].score || 0) : 0;
  const out: Record<string, unknown> = {
    top_dense_score: topDense,
    dense_threshold: Number(threshold),
    dense_pass: selected.length > 0 && topDense >= Number(threshold),
  };
  if (!selected.length) {
    Object.assign(out, {
      ce_available: false,
      ce_applied: false,
      ce_top_score: null,
      ce_second_score: null,
      ce_margin: null,
      ce_pass: false,
    });
    return out;
  }
  // Cross-encoder dropped: no _ce_score present.
  Object.assign(out, {
    ce_available: false,
    ce_applied: false,
    ce_top_score: null,
    ce_second_score: null,
    ce_margin: null,
    ce_pass: null,
  });
  return out;
}

export async function runRagQuery(opts: {
  query: string;
  topK?: number | null;
  threshold?: number | null;
  maxContextTokens?: number | null;
  companyId?: number | null;
  botId?: number | null;
  docIds?: number[] | null;
  botSystemPrompt?: string;
  botChatProvider?: string;
  botChatModel?: string;
  botChatApiKey?: string;
}): Promise<RagResult> {
  const topK = Math.trunc(opts.topK != null ? opts.topK : env.RAG_TOP_K);
  let threshold = Number(opts.threshold != null ? opts.threshold : env.RAG_SIMILARITY_THRESHOLD);
  threshold = Math.max(threshold, env.RAG_SIMILARITY_THRESHOLD);
  const maxContextTokens = Math.trunc(
    opts.maxContextTokens != null ? opts.maxContextTokens : env.RAG_MAX_CONTEXT_TOKENS
  );
  const embeddingKey = String(env.OPENROUTER_API_KEY || "").trim();
  const chatProvider = isChatProvider(opts.botChatProvider) ? opts.botChatProvider : "openrouter";
  const chatModel = String(opts.botChatModel || "").trim() || DEFAULT_CHAT_MODEL[chatProvider];
  const chatApiKey = String(opts.botChatApiKey || "").trim();
  const { companyId = null, botId = null, docIds = null, botSystemPrompt = "" } = opts;

  const base = {
    top_k: topK,
    threshold,
    sentence_evidence: [] as unknown[],
    ab_variant: "control",
  };

  if (!embeddingKey) {
    return {
      answer: UNKNOWN_POLICY_PHRASE,
      fallback_used: true,
      retrieved: [],
      citations: [],
      latency_ms: 0,
      retrieval_diagnostics: { error: "Missing OPENROUTER_API_KEY in server environment." },
      ...base,
      ...pipelineFields(false, "missing_openrouter_api_key"),
    };
  }

  if (!chatApiKey) {
    return {
      answer: UNKNOWN_POLICY_PHRASE,
      fallback_used: true,
      retrieved: [],
      citations: [],
      latency_ms: 0,
      retrieval_diagnostics: { error: "Missing chat API key for selected provider." },
      ...base,
      ...pipelineFields(false, "missing_bot_chat_api_key"),
    };
  }

  if (isObviousGibberishQuery(opts.query)) {
    return {
      answer: UNKNOWN_POLICY_PHRASE,
      fallback_used: true,
      retrieved: [],
      citations: [],
      latency_ms: 0,
      retrieval_diagnostics: {},
      ...base,
      ...pipelineFields(false, "obvious_gibberish_short_circuit"),
    };
  }

  if (isGreeting(opts.query)) {
    return {
      answer: greetingAnswer(opts.query),
      fallback_used: false,
      retrieved: [],
      citations: [],
      latency_ms: 0,
      retrieval_diagnostics: {},
      ...base,
      ...pipelineFields(false, "greeting_short_circuit"),
    };
  }

  const t0 = Date.now();
  try {
    const qdrant = getQdrant();
    const sanitized = sanitizeQuery(opts.query);

    const queryEmbedding = (await getEmbeddings([sanitized]))[0];
    const candidateMultiplier = Math.max(1, env.RAG_CANDIDATE_MULTIPLIER);
    const candidateLimit = Math.max(topK * candidateMultiplier, topK);
    const raw: ScoredPoint[] = await qdrant.search(queryEmbedding, {
      limit: candidateLimit,
      companyId,
      botId,
      docIds,
    });

    const retrieved: RetrievedItem[] = raw.map((item) => ({ score: item.score, payload: item.payload }));
    retrieved.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const strong = retrieved.filter((r) => Number(r.score || 0) >= threshold);
    const selected = (strong.length ? strong : retrieved).slice(0, topK);
    const contextChunks = buildContext(selected, maxContextTokens);

    if (!contextChunks.length) {
      return {
        answer: UNKNOWN_POLICY_PHRASE,
        fallback_used: true,
        retrieved: [],
        citations: [],
        latency_ms: Date.now() - t0,
        retrieval_diagnostics: {
          retrieved_candidates: retrieved.length,
          above_threshold: strong.length,
        },
        ...base,
        ...pipelineFields(true, "dense_rag_empty_context"),
      };
    }

    const relevanceDiag = denseRelevanceDiagnostics(selected, threshold);
    const gateByDense = !relevanceDiag.dense_pass;
    const gateByCrossEncoder = false; // cross-encoder dropped
    if (gateByDense || gateByCrossEncoder) {
      return {
        answer: UNKNOWN_POLICY_PHRASE,
        fallback_used: true,
        retrieved: selected.map((r) => ({
          score: r.score,
          doc_id: (r.payload || {}).doc_id,
          chunk_index: (r.payload || {}).chunk_index,
          chunk_id: (r.payload || {}).chunk_id,
          text_preview: textPreview(String((r.payload || {}).text || "")),
        })),
        citations: contextChunks.map(citationEntry),
        latency_ms: Date.now() - t0,
        retrieval_diagnostics: {
          retrieved_candidates: retrieved.length,
          above_threshold: strong.length,
          selected_for_context: selected.length,
          abstained_by_relevance_gate: true,
          gate_by_dense: gateByDense,
          gate_by_cross_encoder: gateByCrossEncoder,
          ...relevanceDiag,
        },
        ...base,
        ...pipelineFields(true, "dense_rag_abstain_relevance"),
      };
    }

    let llmError: string | null = null;
    let answer = "";
    try {
      answer = (
        await generateAnswer({
          question: sanitized,
          contextChunks: contextChunks as ContextChunk[],
          model: chatModel,
          maxOutputTokens: env.OPENROUTER_MAX_OUTPUT_TOKENS,
          temperature: env.OPENROUTER_TEMPERATURE,
          customSystemPrompt: botSystemPrompt,
          chatProvider,
          chatApiKey,
        })
      ).trim();
    } catch (e) {
      llmError = String((e as Error)?.message || e);
      const [extractive] = extractiveAnswerFromContext(sanitized, contextChunks, env.RAG_STRICT_MAX_SENTENCES);
      answer = (extractive || "").trim();
    }
    if (!answer) answer = UNKNOWN_POLICY_PHRASE;

    const fallback = answer === UNKNOWN_POLICY_PHRASE;
    let pipeline = "dense_rag";
    if (llmError && answer !== UNKNOWN_POLICY_PHRASE) pipeline = "dense_rag_llm_error_extractive_fallback";
    else if (llmError) pipeline = "dense_rag_llm_error";

    return {
      answer,
      fallback_used: fallback,
      retrieved: selected.map((r) => ({
        score: r.score,
        doc_id: (r.payload || {}).doc_id,
        chunk_index: (r.payload || {}).chunk_index,
        chunk_id: (r.payload || {}).chunk_id,
        text_preview: textPreview(String((r.payload || {}).text || "")),
      })),
      citations: contextChunks.map(citationEntry),
      latency_ms: Date.now() - t0,
      retrieval_diagnostics: {
        retrieved_candidates: retrieved.length,
        above_threshold: strong.length,
        selected_for_context: selected.length,
        ...(llmError ? { llm_error: llmError } : {}),
      },
      ...base,
      ...pipelineFields(true, pipeline),
    };
  } catch (e) {
    return {
      answer: UNKNOWN_POLICY_PHRASE,
      fallback_used: true,
      retrieved: [],
      citations: [],
      latency_ms: Date.now() - t0,
      retrieval_diagnostics: { error: String((e as Error)?.message || e) },
      ...base,
      ...pipelineFields(true, "dense_rag_exception"),
    };
  }
}
