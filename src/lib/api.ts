export interface AdminProfile {
  id: number;
  email: string;
  full_name: string;
  company_id: number | null;
  role: "admin" | "super_admin";
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  admin: AdminProfile;
}

export interface Company {
  id: number;
  name: string;
  admin_id: number;
}

import type { ChatProvider } from "./modelCatalog";
import { isChatProvider } from "./modelCatalog";

export interface BotItem {
  id: number;
  company_id: number;
  name: string;
  system_prompt: string;
  chat_provider: ChatProvider;
  chat_model: string;
  chat_api_key?: string;
  openrouter_api_key?: string;
  plan_type: "free" | "paid";
  widget_key: string;
  created_at: string;
}

export interface BotModelConfig {
  embedding_model: string;
  embedding_provider: string;
}

export interface DocumentItemApi {
  id: string;
  bot_id: number | null;
  name: string;
  chunk_count: number;
  embedding_count: number;
  token_count: number;
  created_at: string;
  status?: string;
  size: string;
}

export interface StatsApi {
  total_documents: number;
  total_chunks: number;
  total_vector_embeddings: number;
  total_tokens: number;
}

export interface ChatMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface SuperAdminOverview {
  totals: {
    companies: number;
    admins: number;
    bots: number;
    documents: number;
    chat_queries: number;
    fallback_queries: number;
    fallback_rate: number;
  };
}

export interface SuperAdminCompanyRow {
  company_id: number;
  name: string;
  plan_type: string;
  admin_count: number;
  bot_count: number;
  document_count: number;
  query_count: number;
  created_at: string;
}

export interface PublicWidgetConfig {
  bot_id: number;
  bot_name: string;
  document_count: number;
  welcome_message?: string;
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
export const AUTH_STORAGE_KEY = "md_admin_session_v1";
let refreshPromise: Promise<string | null> | null = null;

export class ApiRequestError extends Error {
  status: number;
  path: string;
  method: string;
  responseBody: unknown;

  constructor(params: {
    message: string;
    status: number;
    path: string;
    method: string;
    responseBody: unknown;
  }) {
    super(params.message);
    this.name = "ApiRequestError";
    this.status = params.status;
    this.path = params.path;
    this.method = params.method;
    this.responseBody = params.responseBody;
  }
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeader(): Record<string, string> {
  const session = getStoredSession();
  if (!session?.accessToken) return {};
  return { Authorization: `Bearer ${session.accessToken}` };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
    const json = atob(payload + pad);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isAccessTokenNearExpiry(token: string, bufferSeconds = 120): boolean {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + bufferSeconds;
}

async function parseError(response: Response): Promise<string> {
  const sanitizeErrorMessage = (raw: string): string => {
    const text = String(raw || "").trim();
    if (!text) return `Request failed with status ${response.status}`;

    // Remove full URLs and endpoint-like paths from user-facing popup messages.
    const withoutUrls = text.replace(/https?:\/\/[^\s"'`]+/gi, "").trim();
    const withoutApiPaths = withoutUrls
      .replace(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/api\/[^\s"'`]+/gi, "")
      .replace(/\/api\/[^\s"'`]+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!withoutApiPaths) return `Request failed with status ${response.status}`;
    return withoutApiPaths;
  };

  try {
    const data = await response.json();
    const hint = typeof data?.hint === "string" ? data.hint.trim() : "";
    let message = "";
    if (typeof data?.detail === "string") message = data.detail;
    else if (typeof data?.error === "string") message = data.error;
    else if (typeof data?.message === "string") message = data.message;
    if (message) {
      const base = sanitizeErrorMessage(message);
      return hint ? `${base} ${sanitizeErrorMessage(hint)}` : base;
    }
  } catch {
    // ignore
  }
  return sanitizeErrorMessage(`Request failed with status ${response.status}`);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

async function refreshAccessTokenIfPossible(): Promise<string | null> {
  const session = getStoredSession();
  if (!session?.refreshToken) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(buildUrl("/api/auth/refresh/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      if (!response.ok) {
        clearStoredSession();
        return null;
      }
      const data = (await response.json()) as { access_token?: string };
      const nextAccessToken = String(data?.access_token || "").trim();
      if (!nextAccessToken) {
        clearStoredSession();
        return null;
      }
      setStoredSession({ ...session, accessToken: nextAccessToken });
      return nextAccessToken;
    } catch {
      clearStoredSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function ensureValidAccessToken(withAuth: boolean): Promise<void> {
  if (!withAuth) return;
  const session = getStoredSession();
  if (!session?.accessToken) return;
  if (isAccessTokenNearExpiry(session.accessToken)) {
    await refreshAccessTokenIfPossible();
  }
}

async function requestJson<T>(path: string, init?: RequestInit, withAuth = false): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  await ensureValidAccessToken(withAuth);
  const execute = async () =>
    fetch(buildUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...(withAuth ? authHeader() : {}),
        ...(init?.headers || {}),
      },
      ...init,
    });
  let response = await execute();
  const isRefreshEndpoint = path.includes("/api/auth/refresh/");
  if (withAuth && response.status === 401 && !isRefreshEndpoint) {
    const refreshed = await refreshAccessTokenIfPossible();
    if (refreshed) {
      response = await execute();
    }
  }

  if (!response.ok) {
    const parsedBody = await parseResponseBody(response);
    throw new ApiRequestError({
      message: await parseError(response),
      status: response.status,
      path,
      method,
      responseBody: parsedBody,
    });
  }
  return response.json() as Promise<T>;
}

async function requestForm<T>(path: string, formData: FormData, withAuth = false): Promise<T> {
  const method = "POST";
  await ensureValidAccessToken(withAuth);
  const execute = async () =>
    fetch(buildUrl(path), {
      method: "POST",
      headers: {
        ...(withAuth ? authHeader() : {}),
      },
      body: formData,
    });
  let response = await execute();
  const isRefreshEndpoint = path.includes("/api/auth/refresh/");
  if (withAuth && response.status === 401 && !isRefreshEndpoint) {
    const refreshed = await refreshAccessTokenIfPossible();
    if (refreshed) {
      response = await execute();
    }
  }
  if (!response.ok) {
    const parsedBody = await parseResponseBody(response);
    throw new ApiRequestError({
      message: await parseError(response),
      status: response.status,
      path,
      method,
      responseBody: parsedBody,
    });
  }
  return response.json() as Promise<T>;
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  setStoredSession(null);
}

export async function logoutAdmin() {
  const session = getStoredSession();
  try {
    if (session?.refreshToken) {
      await requestJson<{ message: string }>(
        "/api/auth/logout/",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        },
        false
      );
    }
  } catch {
    // Best effort logout. Local session cleanup still happens.
  } finally {
    clearStoredSession();
  }
}

export async function signupAdmin(payload: { email: string; password: string; full_name: string }) {
  return requestJson<{ message: string; admin: { id: number; email: string } }>(
    "/api/auth/signup/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function verifyAdminEmail(payload: { email: string; code: string }) {
  return requestJson<{ message: string }>(
    "/api/auth/verify-email/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function resendVerificationCode(payload: { email: string }) {
  return requestJson<{ message: string }>(
    "/api/auth/resend-verification-code/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function forgotPassword(payload: { email: string }) {
  return requestJson<{ message: string }>(
    "/api/auth/forgot-password/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function resetPassword(payload: { email: string; code: string; new_password: string }) {
  return requestJson<{ message: string }>(
    "/api/auth/reset-password/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function loginAdmin(payload: { email: string; password: string }): Promise<AuthSession> {
  const data = await requestJson<{
    access_token: string;
    refresh_token: string;
    admin: AdminProfile;
  }>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const session: AuthSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    admin: data.admin,
  };
  setStoredSession(session);
  return session;
}

export async function createCompany(payload: { name: string; plan_type: "free" | "paid" }) {
  return requestJson<{ message: string; company: Company }>(
    "/api/admin/companies/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true
  );
}

export async function fetchCurrentAdminCompany(): Promise<Company> {
  const data = await requestJson<{ company: Company }>("/api/admin/companies/current/", { method: "GET" }, true);
  return data.company;
}

export async function listBots(companyId?: number): Promise<BotItem[]> {
  const suffix = companyId != null ? `?company_id=${encodeURIComponent(String(companyId))}` : "";
  return requestJson<BotItem[]>(`/api/admin/bots/${suffix}`, { method: "GET" }, true);
}

export async function fetchBotById(botId: number): Promise<BotItem> {
  return fetchBotByIdScoped(botId);
}

export async function fetchBotByIdScoped(botId: number, companyId?: number): Promise<BotItem> {
  const suffix = companyId != null ? `?company_id=${encodeURIComponent(String(companyId))}` : "";
  const data = await requestJson<{ bot?: BotItem; id?: number; company_id?: number; name?: string; system_prompt?: string; openrouter_api_key?: string; plan_type?: "free" | "paid"; widget_key?: string; created_at?: string }>(
    `/api/admin/bots/${botId}/${suffix}`,
    { method: "GET" },
    true
  );
  if (data.bot) return data.bot;
  return {
    id: Number(data.id ?? botId),
    company_id: Number(data.company_id ?? 0),
    name: String(data.name ?? ""),
    system_prompt: String(data.system_prompt ?? ""),
    chat_provider: isChatProvider((data as BotItem).chat_provider) ? (data as BotItem).chat_provider : "openrouter",
    chat_model: String((data as BotItem).chat_model ?? ""),
    chat_api_key: typeof (data as BotItem).chat_api_key === "string" ? (data as BotItem).chat_api_key : "",
    openrouter_api_key: typeof data.openrouter_api_key === "string" ? data.openrouter_api_key : "",
    plan_type: data.plan_type === "paid" ? "paid" : "free",
    widget_key: String(data.widget_key ?? ""),
    created_at: String(data.created_at ?? ""),
  };
}

export interface BotWorkspacePayload {
  bot: BotItem;
  documents: DocumentItemApi[];
  stats: {
    total_documents: number;
    total_chunks: number;
    total_embeddings: number;
    total_tokens: number;
  };
  model_config?: BotModelConfig;
}

const workspaceCache = new Map<string, { data: BotWorkspacePayload; ts: number }>();
const WORKSPACE_CACHE_MS = 60_000;

function workspaceCacheKey(botId: number, companyId?: number) {
  return `${botId}:${companyId ?? "self"}`;
}

export function peekBotWorkspaceCache(botId: number, companyId?: number): BotWorkspacePayload | null {
  const key = workspaceCacheKey(botId, companyId);
  const cached = workspaceCache.get(key);
  if (!cached || Date.now() - cached.ts >= WORKSPACE_CACHE_MS) return null;
  return cached.data;
}

export function invalidateBotWorkspaceCache(botId: number, companyId?: number) {
  workspaceCache.delete(workspaceCacheKey(botId, companyId));
}

export async function fetchBotWorkspace(
  botId: number,
  companyId?: number,
  opts?: { refresh?: boolean }
): Promise<BotWorkspacePayload> {
  const key = workspaceCacheKey(botId, companyId);
  const cached = workspaceCache.get(key);
  if (!opts?.refresh && cached && Date.now() - cached.ts < WORKSPACE_CACHE_MS) {
    return cached.data;
  }

  const suffix = companyId != null ? `?company_id=${encodeURIComponent(String(companyId))}` : "";
  const data = await requestJson<BotWorkspacePayload>(`/api/admin/bots/${botId}/workspace/${suffix}`, { method: "GET" }, true);
  const payload: BotWorkspacePayload = {
    bot: data.bot,
    documents: (data.documents || []).map((item) => mapDocument((item as unknown as Record<string, unknown>) || {})),
    stats: {
      total_documents: Number(data.stats?.total_documents ?? 0),
      total_chunks: Number(data.stats?.total_chunks ?? 0),
      total_embeddings: Number(data.stats?.total_embeddings ?? 0),
      total_tokens: Number(data.stats?.total_tokens ?? 0),
    },
    model_config: data.model_config,
  };
  workspaceCache.set(key, { data: payload, ts: Date.now() });
  return payload;
}

export async function fetchProviderModels(
  provider: ChatProvider,
  chatApiKey: string
): Promise<Array<{ id: string; label: string }>> {
  const data = await requestJson<{ models: Array<{ id: string; label: string }> }>(
    "/api/admin/models/",
    {
      method: "POST",
      body: JSON.stringify({ provider, chat_api_key: chatApiKey }),
    },
    true
  );
  return data.models || [];
}

export async function createBot(payload: {
  name: string;
  system_prompt: string;
  openrouter_api_key?: string;
  plan_type?: "free" | "paid";
  company_id?: number;
}) {
  return requestJson<{ message: string; bot: BotItem }>(
    "/api/admin/bots/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true
  );
}

export async function updateBot(
  botId: number,
  payload: {
    name?: string;
    system_prompt?: string;
    openrouter_api_key?: string;
    chat_provider?: ChatProvider;
    chat_model?: string;
    chat_api_key?: string;
    company_id?: number;
  }
) {
  const suffix = payload.company_id != null ? `?company_id=${encodeURIComponent(String(payload.company_id))}` : "";
  return requestJson<{ message: string; bot: BotItem }>(
    `/api/admin/bots/${botId}/${suffix}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true
  );
}

export async function generateWidgetScript(botId: number, companyId?: number) {
  const suffix = companyId != null ? `?company_id=${encodeURIComponent(String(companyId))}` : "";
  return requestJson<{ widget_script: string; widget_key: string }>(
    `/api/admin/bots/${botId}/widget-script/${suffix}`,
    { method: "POST" },
    true
  );
}

function formatBytes(sizeInBytes: number): string {
  if (sizeInBytes >= 1048576) return `${(sizeInBytes / 1048576).toFixed(1)} MB`;
  return `${(sizeInBytes / 1024).toFixed(1)} KB`;
}

function mapDocument(raw: Record<string, unknown>): DocumentItemApi {
  const tokenCount = Number(raw.token_count ?? 0);
  const chunkCount = Number(raw.chunk_count ?? 0);
  const embeddingCount = Number(raw.embedding_count ?? chunkCount);
  const sizeBytes = Number(raw.size_bytes ?? raw.file_size ?? 0);
  const rawId = raw.id ?? raw.document_id ?? raw.doc_id;
  const rawName = raw.name ?? raw.filename ?? raw.file_name ?? raw.document_name ?? raw.doc_name ?? raw.title;
  const rawBotId = raw.bot_id;
  return {
    id: rawId == null ? "" : String(rawId),
    bot_id: rawBotId == null ? null : Number(rawBotId),
    name: rawName == null || String(rawName).trim() === "" ? "Untitled" : String(rawName),
    token_count: Number.isFinite(tokenCount) ? tokenCount : 0,
    chunk_count: Number.isFinite(chunkCount) ? chunkCount : 0,
    embedding_count: Number.isFinite(embeddingCount) ? embeddingCount : 0,
    created_at: String(raw.created_at ?? raw.created ?? ""),
    status: typeof raw.status === "string" ? raw.status : undefined,
    size: formatBytes(Number.isFinite(sizeBytes) ? sizeBytes : 0),
  };
}

export async function fetchDocuments(botId: number, companyId?: number): Promise<DocumentItemApi[]> {
  const companySuffix = companyId != null ? `&company_id=${encodeURIComponent(String(companyId))}` : "";
  const data = await requestJson<unknown>(`/api/admin/documents/?bot_id=${botId}${companySuffix}`, { method: "GET" }, true);
  if (!Array.isArray(data)) return [];
  return data.map((item) => mapDocument((item as Record<string, unknown>) || {}));
}

export async function fetchStats(botId: number, companyId?: number): Promise<StatsApi> {
  const companySuffix = companyId != null ? `&company_id=${encodeURIComponent(String(companyId))}` : "";
  return requestJson<StatsApi>(`/api/admin/stats/?bot_id=${botId}${companySuffix}`, { method: "GET" }, true);
}

export async function deleteDocument(documentId: string, botId: number, companyId?: number): Promise<void> {
  const companySuffix = companyId != null ? `&company_id=${encodeURIComponent(String(companyId))}` : "";
  const path = `/api/delete/${encodeURIComponent(documentId)}/?bot_id=${botId}${companySuffix}`;
  await ensureValidAccessToken(true);
  const execute = async () =>
    fetch(buildUrl(`/api/delete/${encodeURIComponent(documentId)}/?bot_id=${botId}${companySuffix}`), {
      method: "DELETE",
      headers: {
        ...authHeader(),
      },
    });
  let response = await execute();
  if (response.status === 401) {
    const refreshed = await refreshAccessTokenIfPossible();
    if (refreshed) {
      response = await execute();
    }
  }
  if (!response.ok) {
    const parsedBody = await parseResponseBody(response);
    throw new ApiRequestError({
      message: await parseError(response),
      status: response.status,
      path,
      method: "DELETE",
      responseBody: parsedBody,
    });
  }
}

export async function uploadTextDocument(text: string, botId: number, companyId?: number): Promise<DocumentItemApi> {
  const data = await requestJson<Record<string, unknown>>(
    "/api/admin/documents/ingest/",
    {
      method: "POST",
      body: JSON.stringify({ text, bot_id: botId, ...(companyId != null ? { company_id: companyId } : {}) }),
    },
    true
  );
  const fallbackName = `text_${Date.now().toString().slice(-6)}.txt`;
  return mapDocument({ name: fallbackName, ...data, bot_id: botId });
}

export async function uploadFileDocument(file: File, botId: number, companyId?: number): Promise<DocumentItemApi> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", file.name);
  formData.append("bot_id", String(botId));
  if (companyId != null) formData.append("company_id", String(companyId));
  const data = await requestForm<Record<string, unknown>>("/api/admin/documents/ingest/", formData, true);
  return mapDocument({ name: file.name, ...data, bot_id: botId });
}

export async function sendAdminChatMessage(params: {
  botId: number;
  message: string;
  history: ChatMessagePayload[];
  companyId?: number;
}): Promise<string> {
  const data = await requestJson<Record<string, unknown>>(
    "/api/admin/chat/query/",
    {
      method: "POST",
      body: JSON.stringify({
        bot_id: params.botId,
        query: params.message,
        ...(params.companyId != null ? { company_id: params.companyId } : {}),
      }),
    },
    true
  );
  const answer = typeof data.answer === "string" ? data.answer : "";
  if (!answer) {
    throw new Error("Chat API response is missing an answer field.");
  }
  return answer;
}

export async function fetchSuperAdminOverview(): Promise<SuperAdminOverview> {
  return requestJson<SuperAdminOverview>("/api/super-admin/overview/", { method: "GET" }, true);
}

let superAdminCache: { data: { companies: SuperAdminCompanyRow[]; totals?: SuperAdminOverview["totals"] }; ts: number } | null = null;
const SUPER_ADMIN_CLIENT_CACHE_MS = 90_000;

export function peekSuperAdminCompaniesCache(): {
  companies: SuperAdminCompanyRow[];
  totals?: SuperAdminOverview["totals"];
} | null {
  if (!superAdminCache || Date.now() - superAdminCache.ts >= SUPER_ADMIN_CLIENT_CACHE_MS) return null;
  return superAdminCache.data;
}

export async function fetchSuperAdminCompanies(opts?: { refresh?: boolean }): Promise<{
  companies: SuperAdminCompanyRow[];
  totals?: SuperAdminOverview["totals"];
}> {
  if (!opts?.refresh && superAdminCache && Date.now() - superAdminCache.ts < SUPER_ADMIN_CLIENT_CACHE_MS) {
    return superAdminCache.data;
  }
  const data = await requestJson<{ companies: SuperAdminCompanyRow[]; totals?: SuperAdminOverview["totals"] }>(
    "/api/super-admin/companies/",
    { method: "GET" },
    true
  );
  superAdminCache = { data, ts: Date.now() };
  return data;
}

export async function updateCompanyPlan(companyId: number, planType: "free" | "paid") {
  return requestJson(
    `/api/super-admin/companies/${companyId}/plan/`,
    {
      method: "PATCH",
      body: JSON.stringify({ plan_type: planType }),
    },
    true
  );
}

export async function fetchPublicWidgetConfig(widgetKey: string): Promise<PublicWidgetConfig> {
  return requestJson<PublicWidgetConfig>(
    `/api/public/widget/config/?widget_key=${encodeURIComponent(widgetKey)}`,
    { method: "GET" },
    false
  );
}
