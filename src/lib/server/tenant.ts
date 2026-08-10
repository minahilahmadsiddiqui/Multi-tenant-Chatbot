import "server-only";
import type { AdminUser } from "./auth";
import { getRepo, type BotRecord } from "./repository";
import { ApiError, parseIntOrNull } from "./http";
import { cacheGet, cacheSet } from "./cache";

const COMPANY_CACHE_TTL_SEC = 120;
const BOT_CACHE_TTL_SEC = 60;

export interface ScopeContext {
  searchParams: URLSearchParams;
  body?: Record<string, unknown>;
}

function readParam(ctx: ScopeContext, key: string): unknown {
  const fromQuery = ctx.searchParams.get(key);
  if (fromQuery !== null && fromQuery !== undefined) return fromQuery;
  if (ctx.body && ctx.body[key] !== undefined) return ctx.body[key];
  return null;
}

/**
 * Mirrors Django _current_admin_and_company_id.
 * Returns resolved company_id or throws ApiError with the same messages/status.
 */
export async function resolveCompanyScope(user: AdminUser, ctx: ScopeContext): Promise<number> {
  if (user.company_id != null) return Number(user.company_id);

  if (String(user.role).trim().toLowerCase() === "super_admin") {
    const raw = readParam(ctx, "company_id");
    const parsed = parseIntOrNull(raw);
    if (parsed === null) {
      throw new ApiError(400, { error: "company_id is required for super admin context." });
    }
    const companyKey = `company:${parsed}`;
    const cachedCompany = cacheGet<{ id: number }>(companyKey);
    if (cachedCompany) return parsed;

    const company = await getRepo().getCompany(parsed);
    if (!company) {
      throw new ApiError(404, { error: "Company not found." });
    }
    cacheSet(companyKey, { id: company.id }, COMPANY_CACHE_TTL_SEC);
    return parsed;
  }

  throw new ApiError(400, { error: "Admin is not linked to a company. Create company first." });
}

/**
 * Mirrors Django _current_admin_company_and_bot.
 */
export async function resolveBotScope(
  user: AdminUser,
  ctx: ScopeContext,
  botIdRaw?: unknown
): Promise<{ companyId: number; bot: BotRecord }> {
  const companyId = await resolveCompanyScope(user, ctx);
  let raw = botIdRaw;
  if (raw === undefined || raw === null) {
    raw = (ctx.body && ctx.body.bot_id) ?? ctx.searchParams.get("bot_id");
  }
  const botId = parseIntOrNull(raw);
  if (botId === null) {
    throw new ApiError(400, { error: "bot_id is required." });
  }
  const botKey = `bot:${botId}`;
  let bot = cacheGet<BotRecord>(botKey);
  if (!bot) {
    bot = await getRepo().getBot(botId);
    if (bot) cacheSet(botKey, bot, BOT_CACHE_TTL_SEC);
  }
  if (!bot || Number(bot.company_id) !== Number(companyId)) {
    throw new ApiError(404, { error: "Bot not found." });
  }
  return { companyId, bot };
}

export async function companyPlanMaxBots(companyId: number): Promise<number> {
  const { env } = await import("./env");
  const company = await getRepo().getCompany(companyId);
  if (!company) return 1;
  const planType = String(company.plan_type || "free").trim().toLowerCase() || "free";
  return planType === "paid" ? env.PAID_PLAN_MAX_BOTS : env.FREE_PLAN_MAX_BOTS;
}

export function buildWidgetScript(botWidgetKey: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  const scriptSrc = `${base}/api/public/widget.js`;
  return (
    "<script>\n" +
    `  window.AcmeChatbotConfig = { botKey: '${botWidgetKey}' };\n` +
    "</script>\n" +
    `<script async src="${scriptSrc}"></script>`
  );
}
