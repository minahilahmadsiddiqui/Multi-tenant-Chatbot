import "server-only";
import { env } from "../env";
import { beautifyLlmResponse } from "./beautify";
import { createChatCompletion } from "../llmClient";
import type { ChatProvider } from "../../modelCatalog";
import { DEFAULT_CHAT_MODEL } from "../../modelCatalog";

export const UNKNOWN_POLICY_PHRASE = "The document doesn't mention it.";

export interface ContextChunk {
  text?: string;
  source_section?: string;
  page_number?: number | string | null;
  token_count?: number;
  [key: string]: unknown;
}

function stripTrailingSourcesBlock(text: string): string {
  const t = (text || "").replace(/\s+$/, "");
  const m = t.match(/\n[Ss]ources:\s*\n[\s\S]*$/);
  if (m && m.index !== undefined) return t.slice(0, m.index).replace(/\s+$/, "");
  return t;
}

function stripInlineChunkTags(text: string): string {
  let t = text || "";
  t = t.replace(/\s*\[Chunk\s+\d+\]\s*/gi, " ");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

const STOP = new Set([
  "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "is", "are",
  "be", "this", "that", "it", "as", "at", "by", "from", "what", "how", "when", "where",
  "which", "who", "why", "does", "do", "did", "can", "could", "should", "would", "about",
]);

function kw(text: string): Set<string> {
  const toks = (String(text || "").match(/[a-zA-Z0-9]+/g) || []).map((t) => t.toLowerCase());
  const out = new Set<string>();
  for (const t of toks) if (t.length >= 3 && !STOP.has(t)) out.add(t);
  return out;
}

function intersectSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

const DOMAIN_ANCHOR_WORDS = new Set([
  "policy", "policies", "employee", "employees", "reimbursement",
  "certification", "certifications", "leave", "benefits", "scope", "purpose",
]);

function topicFocusedChunks(question: string, chunks: ContextChunk[], maxChunks = 5): ContextChunk[] {
  let q = kw(question);
  if (!q.size) return chunks.slice(0, maxChunks);
  const anchors = new Set<string>();
  for (const t of (question.toLowerCase().match(/[a-zA-Z0-9]+/g) || [])) {
    if (DOMAIN_ANCHOR_WORDS.has(t)) anchors.add(t);
  }
  q = new Set([...q, ...anchors]);
  const scored: Array<[number, number, ContextChunk]> = [];
  for (const c of chunks) {
    const text = String(c.text || "");
    const sec = String(c.source_section || "");
    const terms = kw(`${sec} ${text}`);
    const secTerms = kw(sec);
    const ov = intersectSize(q, terms);
    const secOv = intersectSize(q, secTerms);
    if (ov <= 0) continue;
    scored.push([secOv, ov, c]);
  }
  if (!scored.length) return chunks.slice(0, maxChunks);
  scored.sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]));
  return scored.slice(0, Math.max(1, maxChunks)).map((x) => x[2]);
}

async function summarizeLlmAnswerForDisplay(
  question: string,
  draftBody: string,
  opts: { provider: ChatProvider; apiKey: string; model: string }
): Promise<string> {
  if (!draftBody.trim() || draftBody.trim() === UNKNOWN_POLICY_PHRASE) return draftBody;
  const model = env.OPENROUTER_SUMMARY_MODEL || opts.model;
  const maxOut = env.OPENROUTER_SUMMARY_MAX_OUTPUT_TOKENS;
  try {
    const response = await createChatCompletion({
      provider: opts.provider,
      apiKey: opts.apiKey,
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a policy-summary editor for an employee handbook chatbot.\n" +
            "Rewrite the draft into a shorter employee-facing answer while preserving policy meaning exactly.\n" +
            "Target about 25-40% fewer words when possible.\n" +
            "Do not remove or alter any policy-critical detail: eligibility, scope, required approvals, " +
            "required documents, timelines/deadlines, amounts/percentages, limits/caps, conditions, " +
            "exceptions, and role/location-specific rules.\n" +
            "Do not add new facts, assumptions, interpretations, or legal advice.\n" +
            "Merge repetition and remove filler, but keep actionable steps in the original order when the draft is procedural.\n" +
            "If the draft contains uncertainty or conditional wording (e.g., may, must, only if, unless), preserve it.\n" +
            "Every sentence must be grammatically complete and standalone; no fragments.\n" +
            "Output only the shortened answer body. Do not include preamble, title, or Sources section.",
        },
        { role: "user", content: `User question:\n${question}\n\nDraft answer:\n${draftBody}` },
      ],
      temperature: 0.08,
      max_tokens: maxOut,
    });
    const shorter = (response.choices[0]?.message?.content || "").trim();
    if (shorter.length < 12) return draftBody;
    return shorter;
  } catch {
    return draftBody;
  }
}

export async function generateAnswer(opts: {
  question: string;
  contextChunks: ContextChunk[];
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  customSystemPrompt?: string;
  chatProvider?: ChatProvider;
  chatApiKey?: string;
}): Promise<string> {
  const {
    question,
    contextChunks,
    maxOutputTokens = env.OPENROUTER_MAX_OUTPUT_TOKENS,
    temperature = env.OPENROUTER_TEMPERATURE,
    customSystemPrompt,
    chatProvider = "openrouter",
    chatApiKey,
  } = opts;
  const model = String(opts.model || "").trim() || DEFAULT_CHAT_MODEL[chatProvider];

  const apiKey = String(chatApiKey || "").trim();
  if (!apiKey) throw new Error("Missing chat API key");

  const focused = topicFocusedChunks(question, contextChunks, env.RAG_LLM_FOCUSED_CONTEXT_CHUNKS);
  const contextText = focused
    .filter((c) => c.text)
    .map((c, i) => {
      const sec = String(c.source_section || "").trim();
      const page = String(c.page_number ?? "").trim();
      return `[Chunk ${i + 1} | Section: ${sec} | Page: ${page}] ${c.text || ""}`.trim();
    })
    .join("\n\n");

  const systemPrompt = (customSystemPrompt || "").trim();
  const prompt =
    "Context (authoritative):\n" +
    `${contextText}\n\n` +
    "Question:\n" +
    `${question}\n\n` +
    "Formatting rules:\n" +
    "1) Use numbered points (1., 2., 3.) for all key items.\n" +
    "2) Put each point on a new line, and leave one blank line between points.\n" +
    "3) Do NOT use markdown symbols such as * or **.\n" +
    "4) Do not include unrelated policies or sections - only what answers the question.\n" +
    "5) Every point must be full, grammatically complete sentences - no mid-sentence fragments.\n" +
    "6) Ground every point strictly in the provided context, but DO NOT print any chunk tags such as [Chunk N].\n" +
    "7) Do not print internal evidence markers, citations, or references in the final answer text.\n" +
    "8) If a point cannot be grounded in context, do not include that point.\n" +
    "9) Output only the answer body in clean user-facing language. Do not add a Sources section.\n";

  const response = await createChatCompletion({
    provider: chatProvider,
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature,
    max_tokens: maxOutputTokens,
  });

  let content = (response.choices[0]?.message?.content || "").trim();
  let finishReason = response.choices[0]?.finish_reason as string | undefined;

  const maxContinuations = Math.min(env.OPENROUTER_MAX_CONTINUATIONS, 3);
  let continuationCount = 0;
  while (finishReason === "length" && content && continuationCount < maxContinuations) {
    const followUp = await createChatCompletion({
      provider: chatProvider,
      apiKey,
      model,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content },
        { role: "user", content: "Continue exactly from where you stopped. Do not repeat prior lines." },
      ],
      temperature,
      max_tokens: maxOutputTokens,
    });
    const continuation = (followUp.choices[0]?.message?.content || "").trim();
    if (!continuation) break;
    content = `${content}\n${continuation}`.trim();
    finishReason = followUp.choices[0]?.finish_reason as string | undefined;
    continuationCount += 1;
  }

  if (!content) return UNKNOWN_POLICY_PHRASE;
  content = stripInlineChunkTags(content);
  if (env.RAG_LLM_POST_SUMMARY) {
    const minChars = env.RAG_SUMMARIZE_MIN_INPUT_CHARS;
    if (content.length >= minChars) {
      let body = stripTrailingSourcesBlock(content);
      if (body.trim().length < 20) body = content;
      const summarized = await summarizeLlmAnswerForDisplay(question, body, {
        provider: chatProvider,
        apiKey,
        model,
      });
      if (summarized.trim()) content = summarized.trim();
    }
  }
  content = stripInlineChunkTags(content);
  const out = beautifyLlmResponse(content);
  return out.trim() ? out : content;
}
