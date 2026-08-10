import "server-only";
import { env } from "../env";
import { getRepo, type SuperAdminAggregates } from "../repository";
import { authenticate, requireSuperAdmin } from "../auth";
import { json, readJson, errorResponse, parseIntOrNull } from "../http";

let aggCache: { data: SuperAdminAggregates; ts: number } | null = null;
let aggInflight: Promise<SuperAdminAggregates> | null = null;

function isTruthyRefresh(v: string | null): boolean {
  return ["1", "true", "yes"].includes(String(v ?? "").trim().toLowerCase());
}

async function getAggregatesCached(forceRefresh: boolean): Promise<SuperAdminAggregates> {
  const ttlMs = env.SUPER_ADMIN_DASHBOARD_CACHE_TTL_SECONDS * 1000;
  const now = Date.now();
  if (!forceRefresh && aggCache && now - aggCache.ts < ttlMs) {
    return aggCache.data;
  }
  if (!forceRefresh && aggInflight) {
    return aggInflight;
  }

  aggInflight = (async () => {
    try {
      const fresh = await getRepo().computeSuperAdminAggregates();
      aggCache = { data: fresh, ts: Date.now() };
      return fresh;
    } finally {
      aggInflight = null;
    }
  })();

  return aggInflight;
}

export async function handleSuperAdminOverview(request: Request) {
  try {
    requireSuperAdmin(await authenticate(request));
    const url = new URL(request.url);
    const agg = await getAggregatesCached(isTruthyRefresh(url.searchParams.get("refresh")));
    return json({ totals: agg.overview_totals });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleSuperAdminCompanies(request: Request) {
  try {
    requireSuperAdmin(await authenticate(request));
    const url = new URL(request.url);
    const agg = await getAggregatesCached(isTruthyRefresh(url.searchParams.get("refresh")));
    const rows = agg.companies.map((c) => {
      const cid = Number(c.id);
      return {
        company_id: cid,
        name: c.name,
        plan_type: c.plan_type,
        admin_count: agg.admin_count_by_company[cid] || 0,
        bot_count: agg.bot_count_by_company[cid] || 0,
        document_count: agg.document_count_by_company[cid] || 0,
        query_count: agg.query_count_by_company[cid] || 0,
        created_at: c.created_at,
      };
    });
    return json({ companies: rows, totals: agg.overview_totals });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleSuperAdminCompanyDetail(request: Request, companyId: string) {
  try {
    requireSuperAdmin(await authenticate(request));
    const repo = getRepo();
    const id = parseIntOrNull(companyId);
    const company = id !== null ? await repo.getCompany(id) : null;
    if (!company) return json({ error: "Company not found." }, 404);

    const admins = await repo.listAdmins({ companyId: company.id });
    const bots = await repo.listBots({ companyId: company.id });
    const docs = await repo.listDocuments({ companyId: company.id });
    const botIds = bots.map((b) => Number(b.id));
    const queryCount = await repo.countChatMessagesForBotIds(botIds);
    const fallbackCount = await repo.countFallbackChatMessagesForBotIds(botIds);
    const fallbackRate = queryCount > 0 ? fallbackCount / queryCount : 0.0;

    return json({
      company: {
        id: Number(company.id),
        name: company.name,
        plan_type: company.plan_type,
        admin_id: Number(company.admin_id),
        domain: company.domain,
        created_at: company.created_at,
      },
      summary: {
        admin_count: admins.length,
        bot_count: bots.length,
        document_count: docs.length,
        chat_queries: queryCount,
        fallback_rate: Math.round(fallbackRate * 10000) / 10000,
      },
      admins: admins.map((a) => ({
        id: Number(a.id),
        email: a.email,
        full_name: a.full_name,
        role: a.role,
        is_verified: Boolean(a.is_verified),
        created_at: a.created_at,
      })),
      bots: bots.map((b) => ({
        id: Number(b.id),
        name: b.name,
        plan_type: b.plan_type,
        created_at: b.created_at,
      })),
      documents: docs.map((d) => ({
        id: Number(d.id),
        bot_id: d.bot_id,
        name: d.name,
        status: d.status,
        chunk_count: d.chunk_count,
        token_count: d.token_count,
        embedding_count: d.embedding_count,
        created_at: d.created_at,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleSuperAdminUpdateCompanyPlan(request: Request, companyId: string) {
  try {
    requireSuperAdmin(await authenticate(request));
    const repo = getRepo();
    const id = parseIntOrNull(companyId);
    const company = id !== null ? await repo.getCompany(id) : null;
    if (!company) return json({ error: "Company not found." }, 404);

    const body = await readJson(request);
    const planType = String(body.plan_type ?? "").trim().toLowerCase();
    if (planType !== "free" && planType !== "paid") {
      return json({ error: "plan_type must be either 'free' or 'paid'." }, 400);
    }
    await repo.updateCompany(Number(id), { plan_type: planType });
    const fresh = await repo.getCompany(Number(id));
    return json({
      message: "Company plan updated.",
      company: { id: Number(fresh!.id), name: fresh!.name, plan_type: fresh!.plan_type },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
