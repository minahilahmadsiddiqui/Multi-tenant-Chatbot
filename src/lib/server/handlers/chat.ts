import "server-only";
import { env } from "../env";
import { getRepo } from "../repository";
import { authenticate, requireAdmin } from "../auth";
import { resolveBotScope } from "../tenant";
import { json, readJson, errorResponse } from "../http";
import { runInBackground } from "../email";
import { runRagQuery, type RagResult } from "../rag/rag";
import { buildChatResponse, buildAnswerParts, retrievedChunkIds } from "./chatShared";
import type { Citation } from "../rag/beautify";
import { resolveBotChatConfig } from "../botModelConfig";
import type { BotRecord } from "../repository";

function parseTopKThreshold(body: Record<string, unknown>): { topK: number; threshold: number } | null {
  const topKRaw = body.top_k != null ? body.top_k : env.RAG_TOP_K;
  const thresholdRaw = body.threshold != null ? body.threshold : env.RAG_SIMILARITY_THRESHOLD;
  const topK = Number(topKRaw);
  const threshold = Number(thresholdRaw);
  if (!Number.isFinite(topK) || !Number.isFinite(threshold)) return null;
  return { topK: Math.trunc(topK), threshold };
}

function ragQueryOptsForBot(
  bot: BotRecord,
  base: { query: string; topK: number; threshold: number; companyId: number; botId: number }
) {
  const chat = resolveBotChatConfig(bot);
  return {
    ...base,
    botSystemPrompt: String(bot.system_prompt || ""),
    botChatProvider: chat.provider,
    botChatModel: chat.model,
    botChatApiKey: chat.chatApiKey,
  };
}

function persistChatMessage(opts: {
  sessionId: string;
  botId: number;
  query: string;
  citations: Citation[];
  answer: string;
  latencyMs: number;
  fallbackUsed: boolean;
  modelUsed: string;
}) {
  runInBackground(() =>
    getRepo().createChatMessage({
      session_id: opts.sessionId,
      bot_id: opts.botId,
      query: opts.query,
      retrieved_chunk_ids: retrievedChunkIds(opts.citations),
      model_used: opts.modelUsed,
      response_text: opts.answer,
      latency_ms: opts.latencyMs,
      fallback_used: opts.fallbackUsed,
    })
  );
}

export async function handleAdminChatQuery(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const body = await readJson(request);
    const parsed = parseTopKThreshold(body);
    if (!parsed) return json({ error: "Invalid 'top_k' or 'threshold' types." }, 400);
    const sessionId = String(body.session_id || "default");
    const query = String(body.query || "");

    const { companyId, bot } = await resolveBotScope(user, { searchParams: url.searchParams, body });
    const chat = resolveBotChatConfig(bot);

    const t0 = Date.now();
    const result = await runRagQuery(
      ragQueryOptsForBot(bot, {
        query,
        topK: parsed.topK,
        threshold: parsed.threshold,
        companyId,
        botId: Number(bot.id),
      })
    );
    const latencyMs = Date.now() - t0;

    const { citations, ans } = buildAnswerParts(result);
    persistChatMessage({
      sessionId,
      botId: Number(bot.id),
      query,
      citations,
      answer: ans,
      latencyMs,
      fallbackUsed: Boolean(result.fallback_used),
      modelUsed: chat.model,
    });

    return json(buildChatResponse(result, latencyMs));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleAdminChatQueryStream(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const body = await readJson(request);
    const parsed = parseTopKThreshold(body);
    if (!parsed) return json({ error: "Invalid 'top_k' or 'threshold' types." }, 400);
    const sessionId = String(body.session_id || "default");
    const query = String(body.query || "");

    const { companyId, bot } = await resolveBotScope(user, { searchParams: url.searchParams, body });
    const chat = resolveBotChatConfig(bot);

    const result = await runRagQuery(
      ragQueryOptsForBot(bot, {
        query,
        topK: parsed.topK,
        threshold: parsed.threshold,
        companyId,
        botId: Number(bot.id),
      })
    );

    const { citations, ans, ansHtml } = buildAnswerParts(result);
    const latencyMs = Number(result.latency_ms || 0);

    await getRepo().createChatMessage({
      session_id: sessionId,
      bot_id: Number(bot.id),
      query,
      retrieved_chunk_ids: retrievedChunkIds(citations),
      model_used: chat.model,
      response_text: ans,
      latency_ms: latencyMs,
      fallback_used: Boolean(result.fallback_used),
    });

    const donePayload = {
      top_k: result.top_k,
      threshold: result.threshold,
      rag_retrieval_ran: result.rag_retrieval_ran,
      pipeline: result.pipeline,
      retrieval_diagnostics: result.retrieval_diagnostics || {},
      sentence_evidence: result.sentence_evidence || [],
      ab_variant: result.ab_variant,
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("event: start\ndata: {}\n\n"));
        controller.enqueue(encoder.encode(`event: answer\ndata: ${JSON.stringify(ans)}\n\n`));
        controller.enqueue(encoder.encode(`event: answer_html\ndata: ${JSON.stringify(ansHtml)}\n\n`));
        controller.enqueue(encoder.encode(`event: citations\ndata: ${JSON.stringify(citations)}\n\n`));
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handlePublicChatQuery(request: Request) {
  try {
    const body = await readJson(request);
    const widgetKey = String(body.widget_key || "").trim();
    const query = String(body.query || "");
    const sessionId = String(body.session_id || "widget-default");
    if (!widgetKey) return json({ error: "widget_key is required." }, 400);

    const bot = await getRepo().findBotByWidgetKey(widgetKey);
    if (!bot) return json({ error: "Invalid widget key." }, 404);

    const parsed = parseTopKThreshold(body);
    if (!parsed) return json({ error: "Invalid 'top_k' or 'threshold' types." }, 400);

    const t0 = Date.now();
    const result: RagResult = await runRagQuery(
      ragQueryOptsForBot(bot, {
        query,
        topK: parsed.topK,
        threshold: parsed.threshold,
        companyId: Number(bot.company_id),
        botId: Number(bot.id),
      })
    );
    const latencyMs = Date.now() - t0;

    const payload = buildChatResponse(result, latencyMs);
    return json({ ...payload, bot_id: bot.id });
  } catch (e) {
    return errorResponse(e);
  }
}
