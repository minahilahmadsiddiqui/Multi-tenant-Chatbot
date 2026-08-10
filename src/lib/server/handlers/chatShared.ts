import "server-only";
import { env } from "../env";
import {
  cleanAnswerBodyOnly,
  formatPlainAnswerWithMetadata,
  buildChatAnswerHtml,
  type Citation,
} from "../rag/beautify";
import { FALLBACK_PHRASE, type RagResult } from "../rag/rag";

export interface ChatResponsePayload {
  answer: string;
  answer_html: string;
  fallback_used: boolean;
  retrieved: unknown[];
  citations: unknown[];
  retrieval_diagnostics: Record<string, unknown>;
  sentence_evidence: unknown[];
  ab_variant: unknown;
  latency_ms: number;
  top_k: unknown;
  threshold: unknown;
  rag_retrieval_ran: unknown;
  pipeline: unknown;
}

export function buildAnswerParts(result: RagResult) {
  const citations = (result.citations || []) as Citation[];
  const ansRaw = result.answer || FALLBACK_PHRASE;
  const ansBody = cleanAnswerBodyOnly(ansRaw, citations);
  const appendMeta = result.pipeline !== "greeting_short_circuit";
  const ans = formatPlainAnswerWithMetadata(ansBody, citations, appendMeta);
  const ansHtml = buildChatAnswerHtml(ansBody, citations, appendMeta);
  return { citations, ans, ansBody, ansHtml, appendMeta };
}

export function buildChatResponse(result: RagResult, latencyMs: number): ChatResponsePayload {
  const { citations, ans, ansHtml } = buildAnswerParts(result);
  return {
    answer: ans,
    answer_html: ansHtml,
    fallback_used: Boolean(result.fallback_used),
    retrieved: result.retrieved || [],
    citations,
    retrieval_diagnostics: result.retrieval_diagnostics || {},
    sentence_evidence: result.sentence_evidence || [],
    ab_variant: result.ab_variant,
    latency_ms: latencyMs,
    top_k: result.top_k,
    threshold: result.threshold,
    rag_retrieval_ran: result.rag_retrieval_ran,
    pipeline: result.pipeline,
  };
}

export function retrievedChunkIds(citations: Citation[]): string[] {
  const ids: string[] = [];
  for (const c of citations) {
    if (c.chunk_id != null) ids.push(String(c.chunk_id));
    else if (c.chunk_index != null) ids.push(String(c.chunk_index));
  }
  return ids;
}

export const CHAT_MODEL_USED = env.OPENROUTER_CHAT_MODEL || "google/gemini-2.5-flash";
