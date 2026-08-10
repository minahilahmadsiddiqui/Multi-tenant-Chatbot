import "server-only";
import { getRepo, type BotRecord } from "../repository";
import { authenticate, requireAdmin } from "../auth";
import { resolveCompanyScope, resolveBotScope, buildWidgetScript } from "../tenant";
import { json, readJson, errorResponse, ApiError, parseIntOrNull } from "../http";
import { widgetKey as genWidgetKey } from "../ids";
import {
  getBotWorkspaceCached,
  invalidateBotWorkspaceServerCache,
  setBotWorkspaceCached,
} from "../workspaceCache";
import { env } from "../env";
import { isChatProvider, normalizeChatModel, type ChatProvider } from "../../modelCatalog";
import { defaultBotModelFields } from "../botModelConfig";

function serializeBot(b: BotRecord) {
  const defaults = defaultBotModelFields();
  const provider: ChatProvider = isChatProvider(b.chat_provider)
    ? (b.chat_provider as ChatProvider)
    : (defaults.chat_provider as ChatProvider);
  return {
    id: b.id,
    company_id: b.company_id,
    name: b.name,
    system_prompt: b.system_prompt,
    chat_provider: provider,
    chat_model: normalizeChatModel(provider, b.chat_model || defaults.chat_model),
    chat_api_key: b.chat_api_key,
    openrouter_api_key: b.openrouter_api_key,
    plan_type: b.plan_type,
    widget_key: b.widget_key,
    created_at: b.created_at,
  };
}

export async function handleBotsList(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const companyId = await resolveCompanyScope(user, { searchParams: url.searchParams });
    const rows = await getRepo().listBots({ companyId });
    return json(rows.map(serializeBot));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleBotsCreate(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const body = await readJson(request);
    const companyId = await resolveCompanyScope(user, { searchParams: url.searchParams, body });
    const repo = getRepo();

    const name = String(body.name ?? "").trim();
    const systemPrompt = String(body.system_prompt ?? "").trim();
    const openrouterApiKey = String(body.openrouter_api_key ?? "").trim();
    if (!name) return json({ error: "name is required." }, 400);

    const existing = await repo.listBots({ companyId });
    if (existing.length >= 1) {
      return json({ error: "Only one bot is allowed per company." }, 400);
    }
    const bot = await repo.createBot({
      company_id: companyId,
      name,
      system_prompt: systemPrompt,
      ...defaultBotModelFields(),
      openrouter_api_key: openrouterApiKey,
      plan_type: "free",
      widget_key: genWidgetKey(),
    });
    return json({ message: "Bot created.", bot: serializeBot(bot) }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleBotDetailGet(request: Request, botId: string) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const { companyId, bot } = await resolveBotScope(user, { searchParams: url.searchParams }, parseIntOrNull(botId));
    return json({ ...serializeBot(bot), company_id: companyId });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleBotDetailPatch(request: Request, botId: string) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const body = await readJson(request);
    const { bot } = await resolveBotScope(user, { searchParams: url.searchParams, body }, parseIntOrNull(botId));
    const repo = getRepo();

    const updates: Record<string, unknown> = {};
    if ("name" in body) {
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "name cannot be empty." }, 400);
      updates.name = name;
    }
    if ("system_prompt" in body) updates.system_prompt = String(body.system_prompt ?? "").trim();
    if ("openrouter_api_key" in body) updates.openrouter_api_key = String(body.openrouter_api_key ?? "").trim();
    if ("chat_api_key" in body) updates.chat_api_key = String(body.chat_api_key ?? "").trim();
    if ("chat_provider" in body) {
      const provider = String(body.chat_provider ?? "").trim().toLowerCase();
      if (!isChatProvider(provider)) {
        return json({ error: "chat_provider must be one of: openai, google, anthropic, openrouter." }, 400);
      }
      updates.chat_provider = provider;
      if (!("chat_model" in body)) {
        updates.chat_model = normalizeChatModel(provider, bot.chat_model);
      }
    }
    if ("chat_model" in body) {
      const provider = isChatProvider(updates.chat_provider as string)
        ? (updates.chat_provider as import("../../modelCatalog").ChatProvider)
        : isChatProvider(bot.chat_provider)
          ? bot.chat_provider
          : "openrouter";
      updates.chat_model = normalizeChatModel(provider, body.chat_model);
    }
    if (Object.keys(updates).length === 0) return json({ error: "No updates provided." }, 400);

    await repo.updateBot(bot.id, updates);
    invalidateBotWorkspaceServerCache(Number(bot.company_id), bot.id);
    const fresh = await repo.getBot(bot.id);
    if (!fresh) throw new ApiError(404, { error: "Bot not found." });
    return json({ message: "Bot updated.", bot: serializeBot(fresh) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleGenerateWidgetScript(request: Request, botId: string) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const { bot } = await resolveBotScope(user, { searchParams: url.searchParams }, parseIntOrNull(botId));
    const origin = url.origin;
    return json({
      bot_id: bot.id,
      widget_key: bot.widget_key,
      widget_script: buildWidgetScript(bot.widget_key, origin),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

function serializeDocumentSummary(doc: {
  id: number;
  bot_id: number | null;
  name: string;
  chunk_count: number | null;
  embedding_count: number | null;
  token_count: number | null;
  status: string;
  created_at: string;
}) {
  return {
    id: String(doc.id),
    bot_id: doc.bot_id,
    name: doc.name,
    chunk_count: doc.chunk_count ?? 0,
    embedding_count: doc.embedding_count ?? 0,
    token_count: doc.token_count ?? 0,
    status: doc.status,
    created_at: doc.created_at,
    size: doc.token_count ? `${doc.token_count} tokens` : "-",
  };
}

function isTruthyRefresh(v: string | null): boolean {
  return ["1", "true", "yes"].includes(String(v ?? "").trim().toLowerCase());
}

export async function handleBotWorkspace(request: Request, botId: string) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const { companyId, bot } = await resolveBotScope(user, { searchParams: url.searchParams }, parseIntOrNull(botId));
    const forceRefresh = isTruthyRefresh(url.searchParams.get("refresh"));

    if (!forceRefresh) {
      const cached = getBotWorkspaceCached(companyId, bot.id);
      if (cached) return json(cached);
    }

    const repo = getRepo();
    const documents = await repo.listDocumentsForBot({ companyId, botId: bot.id });

    const stats = {
      total_documents: documents.length,
      total_chunks: documents.reduce((a, d) => a + (d.chunk_count || 0), 0),
      total_embeddings: documents.reduce((a, d) => a + (d.embedding_count || 0), 0),
      total_tokens: documents.reduce((a, d) => a + (d.token_count || 0), 0),
    };

    const payload = {
      bot: serializeBot(bot),
      documents: documents.map(serializeDocumentSummary),
      stats,
      model_config: {
        embedding_model: env.OPENROUTER_EMBEDDING_MODEL,
        embedding_provider: "openrouter",
      },
    };
    setBotWorkspaceCached(companyId, bot.id, payload);
    return json(payload);
  } catch (e) {
    return errorResponse(e);
  }
}
