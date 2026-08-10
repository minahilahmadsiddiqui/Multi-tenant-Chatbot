import "server-only";
import { cacheDelete, cacheGet, cacheSet } from "./cache";
import { env } from "./env";

export interface BotWorkspaceCachePayload {
  bot: Record<string, unknown>;
  documents: Record<string, unknown>[];
  stats: {
    total_documents: number;
    total_chunks: number;
    total_embeddings: number;
    total_tokens: number;
  };
}

function cacheKey(companyId: number, botId: number): string {
  return `bot-workspace:${companyId}:${botId}`;
}

export function getBotWorkspaceCached(companyId: number, botId: number): BotWorkspaceCachePayload | null {
  return cacheGet<BotWorkspaceCachePayload>(cacheKey(companyId, botId));
}

export function setBotWorkspaceCached(companyId: number, botId: number, payload: BotWorkspaceCachePayload): void {
  cacheSet(cacheKey(companyId, botId), payload, env.BOT_WORKSPACE_CACHE_TTL_SECONDS);
}

export function invalidateBotWorkspaceServerCache(companyId: number, botId: number): void {
  cacheDelete(cacheKey(companyId, botId));
}
