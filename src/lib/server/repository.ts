import "server-only";
import { getFirestore } from "./firebase";
import type { firestore } from "firebase-admin";

export interface DocumentRecord {
  id: number;
  company_id: number | null;
  bot_id: number | null;
  name: string;
  content_hash: string | null;
  content_length: number | null;
  chunk_count: number | null;
  token_count: number | null;
  embedding_count: number | null;
  status: string;
  error_message: string;
  created_at: string;
}

export interface AdminRecord {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  company_id: number | null;
  role: string;
  is_verified: boolean;
  verification_code: string | null;
  verification_expires_at: string | null;
  password_reset_code: string | null;
  password_reset_expires_at: string | null;
  created_at: string;
}

export interface CompanyRecord {
  id: number;
  name: string;
  domain: string;
  admin_id: number;
  plan_type: string;
  created_at: string;
}

export interface BotRecord {
  id: number;
  company_id: number;
  name: string;
  system_prompt: string;
  chat_provider: string;
  chat_model: string;
  chat_api_key: string;
  openrouter_api_key: string;
  plan_type: string;
  widget_key: string;
  created_at: string;
}

export interface PaymentRecord {
  id: number;
  company_id: number;
  admin_id: number;
  bot_name: string;
  amount_pkr: number;
  amount_usd: number;
  currency: string;
  payment_method: string;
  card_type: string | null;
  provider: string;
  provider_intent_id: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asInt(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function asIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function sortByCreatedDesc<T extends { created_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

type Data = firestore.DocumentData;

function documentFromData(data: Data | undefined): DocumentRecord | null {
  if (!data) return null;
  return {
    id: asInt(data.id),
    company_id: asIntOrNull(data.company_id),
    bot_id: asIntOrNull(data.bot_id),
    name: String(data.name ?? ""),
    content_hash: data.content_hash != null ? String(data.content_hash) : null,
    content_length: asIntOrNull(data.content_length),
    chunk_count: asIntOrNull(data.chunk_count),
    token_count: asIntOrNull(data.token_count),
    embedding_count: asIntOrNull(data.embedding_count),
    status: String(data.status ?? "ready"),
    error_message: String(data.error_message ?? ""),
    created_at: String(data.created_at ?? nowIso()),
  };
}

function adminFromData(data: Data | undefined): AdminRecord | null {
  if (!data) return null;
  return {
    id: asInt(data.id),
    email: String(data.email ?? "").toLowerCase(),
    password_hash: String(data.password_hash ?? ""),
    full_name: String(data.full_name ?? ""),
    company_id: asIntOrNull(data.company_id),
    role: String(data.role ?? "admin"),
    is_verified: Boolean(data.is_verified ?? false),
    verification_code: data.verification_code != null ? String(data.verification_code) : null,
    verification_expires_at: data.verification_expires_at != null ? String(data.verification_expires_at) : null,
    password_reset_code: data.password_reset_code != null ? String(data.password_reset_code) : null,
    password_reset_expires_at: data.password_reset_expires_at != null ? String(data.password_reset_expires_at) : null,
    created_at: String(data.created_at ?? nowIso()),
  };
}

function companyFromData(data: Data | undefined): CompanyRecord | null {
  if (!data) return null;
  return {
    id: asInt(data.id),
    name: String(data.name ?? ""),
    domain: String(data.domain ?? "").toLowerCase(),
    admin_id: asInt(data.admin_id),
    plan_type: (String(data.plan_type ?? "free").trim().toLowerCase() || "free"),
    created_at: String(data.created_at ?? nowIso()),
  };
}

function botFromData(data: Data | undefined): BotRecord | null {
  if (!data) return null;
  return {
    id: asInt(data.id),
    company_id: asInt(data.company_id),
    name: String(data.name ?? "").trim(),
    system_prompt: String(data.system_prompt ?? ""),
    chat_provider: String(data.chat_provider ?? "openrouter").trim().toLowerCase() || "openrouter",
    chat_model: String(data.chat_model ?? "").trim(),
    chat_api_key: String(data.chat_api_key ?? "").trim(),
    openrouter_api_key: String(data.openrouter_api_key ?? ""),
    plan_type: (String(data.plan_type ?? "free").trim().toLowerCase() || "free"),
    widget_key: String(data.widget_key ?? "").trim(),
    created_at: String(data.created_at ?? nowIso()),
  };
}

function paymentFromData(data: Data | undefined): PaymentRecord | null {
  if (!data) return null;
  return {
    id: asInt(data.id),
    company_id: asInt(data.company_id),
    admin_id: asInt(data.admin_id),
    bot_name: String(data.bot_name ?? "").trim(),
    amount_pkr: asInt(data.amount_pkr),
    amount_usd: Number(data.amount_usd ?? 0),
    currency: String(data.currency ?? "PKR").toUpperCase(),
    payment_method: String(data.payment_method ?? "card").toLowerCase(),
    card_type: data.card_type != null ? String(data.card_type).toLowerCase() : null,
    provider: String(data.provider ?? "sandbox").toLowerCase(),
    provider_intent_id: String(data.provider_intent_id ?? "").trim(),
    status: String(data.status ?? "pending").toLowerCase(),
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    created_at: String(data.created_at ?? nowIso()),
    updated_at: String(data.updated_at ?? nowIso()),
    paid_at: data.paid_at != null ? String(data.paid_at) : null,
  };
}

class FirestoreRepository {
  private get db() {
    return getFirestore();
  }

  private col(name: string) {
    return this.db.collection(name);
  }

  private async nextId(counterName: string): Promise<number> {
    const ref = this.db.collection("_counters").doc(counterName);
    const next = await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? asInt(snap.data()?.value, 0) : 0;
      const nxt = current + 1;
      tx.set(ref, { value: nxt }, { merge: true });
      return nxt;
    });
    return next;
  }

  // ---- Documents ----
  async findDocumentByContentHash(
    contentHash: string,
    opts: { companyId?: number | null; botId?: number | null } = {}
  ): Promise<DocumentRecord | null> {
    let q: firestore.Query = this.col("documents").where("content_hash", "==", contentHash);
    if (opts.companyId != null) q = q.where("company_id", "==", Number(opts.companyId));
    if (opts.botId != null) q = q.where("bot_id", "==", Number(opts.botId));
    const snap = await q.limit(1).get();
    if (snap.empty) return null;
    return documentFromData(snap.docs[0].data());
  }

  async getDocument(documentId: number): Promise<DocumentRecord | null> {
    const snap = await this.col("documents").doc(String(documentId)).get();
    return documentFromData(snap.data());
  }

  async createDocument(payload: Record<string, unknown>): Promise<DocumentRecord> {
    const id = await this.nextId("documents");
    const data = {
      id,
      company_id: payload.company_id != null ? Number(payload.company_id) : null,
      bot_id: payload.bot_id != null ? Number(payload.bot_id) : null,
      name: String(payload.name ?? ""),
      content_hash: payload.content_hash != null ? String(payload.content_hash) : null,
      content_length: payload.content_length != null ? Number(payload.content_length) : null,
      chunk_count: payload.chunk_count != null ? Number(payload.chunk_count) : null,
      token_count: payload.token_count != null ? Number(payload.token_count) : null,
      embedding_count: payload.embedding_count != null ? Number(payload.embedding_count) : null,
      status: String(payload.status ?? "processing"),
      error_message: String(payload.error_message ?? ""),
      created_at: payload.created_at ? String(payload.created_at) : nowIso(),
    };
    await this.col("documents").doc(String(id)).set(data);
    return documentFromData(data)!;
  }

  async updateDocument(documentId: number, updates: Record<string, unknown>): Promise<void> {
    await this.col("documents").doc(String(documentId)).set(updates, { merge: true });
  }

  async deleteDocument(documentId: number): Promise<void> {
    await this.col("documents").doc(String(documentId)).delete();
  }

  async listDocuments(opts: { companyId?: number | null } = {}): Promise<DocumentRecord[]> {
    let q: firestore.Query = this.col("documents");
    if (opts.companyId != null) q = q.where("company_id", "==", Number(opts.companyId));
    const snap = await q.get();
    const rows = snap.docs.map((d) => documentFromData(d.data())!).filter(Boolean);
    return sortByCreatedDesc(rows);
  }

  async listDocumentsForBot(opts: { companyId: number; botId: number }): Promise<DocumentRecord[]> {
    const snap = await this.col("documents")
      .where("company_id", "==", Number(opts.companyId))
      .where("bot_id", "==", Number(opts.botId))
      .get();
    const rows = snap.docs.map((d) => documentFromData(d.data())!).filter(Boolean);
    return sortByCreatedDesc(rows);
  }

  async getStats(opts: { companyId?: number | null } = {}): Promise<{
    total_documents: number;
    total_chunks: number;
    total_vector_embeddings: number;
    total_tokens: number;
  }> {
    const docs = await this.listDocuments(opts);
    return {
      total_documents: docs.length,
      total_chunks: docs.reduce((a, d) => a + (d.chunk_count || 0), 0),
      total_vector_embeddings: docs.reduce((a, d) => a + (d.embedding_count || 0), 0),
      total_tokens: docs.reduce((a, d) => a + (d.token_count || 0), 0),
    };
  }

  // ---- Chat messages ----
  async createChatMessage(payload: Record<string, unknown>): Promise<void> {
    const data = {
      session_id: String(payload.session_id ?? "default"),
      bot_id: payload.bot_id != null ? Number(payload.bot_id) : null,
      query: String(payload.query ?? ""),
      retrieved_chunk_ids: (payload.retrieved_chunk_ids as string[]) ?? [],
      model_used: String(payload.model_used ?? ""),
      response_text: String(payload.response_text ?? ""),
      latency_ms: Number(payload.latency_ms ?? 0),
      fallback_used: Boolean(payload.fallback_used ?? false),
      created_at: nowIso(),
    };
    await this.col("chat_messages").add(data);
  }

  async countChatMessages(): Promise<number> {
    const snap = await this.col("chat_messages").count().get();
    return snap.data().count;
  }

  async countChatMessagesForBotIds(botIds: number[]): Promise<number> {
    if (!botIds.length) return 0;
    let total = 0;
    for (let i = 0; i < botIds.length; i += 10) {
      const chunk = botIds.slice(i, i + 10).map(Number);
      const snap = await this.col("chat_messages").where("bot_id", "in", chunk).count().get();
      total += snap.data().count;
    }
    return total;
  }

  async countFallbackChatMessages(): Promise<number> {
    const snap = await this.col("chat_messages").where("fallback_used", "==", true).count().get();
    return snap.data().count;
  }

  async countFallbackChatMessagesForBotIds(botIds: number[]): Promise<number> {
    if (!botIds.length) return 0;
    let total = 0;
    for (let i = 0; i < botIds.length; i += 10) {
      const chunk = botIds.slice(i, i + 10).map(Number);
      const snap = await this.col("chat_messages")
        .where("bot_id", "in", chunk)
        .where("fallback_used", "==", true)
        .count()
        .get();
      total += snap.data().count;
    }
    return total;
  }

  // ---- Admins ----
  async findAdminByEmail(email: string): Promise<AdminRecord | null> {
    const normalized = String(email || "").trim().toLowerCase();
    const snap = await this.col("admins").where("email", "==", normalized).limit(1).get();
    if (snap.empty) return null;
    return adminFromData(snap.docs[0].data());
  }

  async getAdmin(adminId: number): Promise<AdminRecord | null> {
    const snap = await this.col("admins").doc(String(adminId)).get();
    return adminFromData(snap.data());
  }

  async findSuperAdmin(): Promise<AdminRecord | null> {
    const snap = await this.col("admins").where("role", "==", "super_admin").limit(1).get();
    if (snap.empty) return null;
    return adminFromData(snap.docs[0].data());
  }

  async createAdmin(payload: Record<string, unknown>): Promise<AdminRecord> {
    const id = await this.nextId("admins");
    const data = {
      id,
      email: String(payload.email ?? "").trim().toLowerCase(),
      password_hash: String(payload.password_hash ?? ""),
      full_name: String(payload.full_name ?? ""),
      company_id: payload.company_id != null ? Number(payload.company_id) : null,
      role: String(payload.role ?? "admin"),
      is_verified: Boolean(payload.is_verified ?? false),
      verification_code: payload.verification_code != null ? String(payload.verification_code) : null,
      verification_expires_at:
        payload.verification_expires_at != null ? String(payload.verification_expires_at) : null,
      password_reset_code: payload.password_reset_code != null ? String(payload.password_reset_code) : null,
      password_reset_expires_at:
        payload.password_reset_expires_at != null ? String(payload.password_reset_expires_at) : null,
      created_at: nowIso(),
    };
    await this.col("admins").doc(String(id)).set(data);
    return adminFromData(data)!;
  }

  async updateAdmin(adminId: number, updates: Record<string, unknown>): Promise<void> {
    await this.col("admins").doc(String(adminId)).set(updates, { merge: true });
  }

  async deleteAdmin(adminId: number): Promise<void> {
    await this.col("admins").doc(String(adminId)).delete();
  }

  async listAdmins(opts: { companyId?: number | null } = {}): Promise<AdminRecord[]> {
    let q: firestore.Query = this.col("admins");
    if (opts.companyId != null) q = q.where("company_id", "==", Number(opts.companyId));
    const snap = await q.get();
    return snap.docs.map((d) => adminFromData(d.data())!).filter(Boolean);
  }

  // ---- Refresh tokens ----
  async storeRefreshToken(opts: { jti: string; adminId: number; expiresAt: string }): Promise<void> {
    await this.col("refresh_tokens").doc(opts.jti).set({
      jti: opts.jti,
      admin_id: Number(opts.adminId),
      created_at: nowIso(),
      expires_at: opts.expiresAt,
    });
  }

  async getRefreshToken(jti: string): Promise<Record<string, unknown> | null> {
    const snap = await this.col("refresh_tokens").doc(jti).get();
    return snap.exists ? (snap.data() as Record<string, unknown>) : null;
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    await this.col("refresh_tokens").doc(jti).delete();
  }

  // ---- Companies ----
  async findCompanyByName(name: string): Promise<CompanyRecord | null> {
    const normalized = String(name || "").trim().toLowerCase();
    const snap = await this.col("companies").where("name_normalized", "==", normalized).limit(1).get();
    if (snap.empty) return null;
    return companyFromData(snap.docs[0].data());
  }

  async getCompany(companyId: number): Promise<CompanyRecord | null> {
    const snap = await this.col("companies").doc(String(companyId)).get();
    return companyFromData(snap.data());
  }

  async updateCompany(companyId: number, updates: Record<string, unknown>): Promise<void> {
    await this.col("companies").doc(String(companyId)).set(updates, { merge: true });
  }

  async listCompanies(): Promise<CompanyRecord[]> {
    const snap = await this.col("companies").get();
    const rows = snap.docs.map((d) => companyFromData(d.data())!).filter(Boolean);
    return sortByCreatedDesc(rows);
  }

  async createCompany(payload: Record<string, unknown>): Promise<CompanyRecord> {
    const id = await this.nextId("companies");
    const name = String(payload.name ?? "").trim();
    const data = {
      id,
      name,
      name_normalized: name.toLowerCase(),
      domain: String(payload.domain ?? "").trim().toLowerCase(),
      admin_id: Number(payload.admin_id),
      plan_type: (String(payload.plan_type ?? "free").trim().toLowerCase() || "free"),
      created_at: nowIso(),
    };
    await this.col("companies").doc(String(id)).set(data);
    return companyFromData(data)!;
  }

  // ---- Bots ----
  async createBot(payload: Record<string, unknown>): Promise<BotRecord> {
    const id = await this.nextId("bots");
    const data = {
      id,
      company_id: Number(payload.company_id),
      name: String(payload.name ?? "").trim(),
      system_prompt: String(payload.system_prompt ?? ""),
      chat_provider: String(payload.chat_provider ?? "openrouter").trim().toLowerCase() || "openrouter",
      chat_model: String(payload.chat_model ?? "").trim(),
      chat_api_key: String(payload.chat_api_key ?? "").trim(),
      openrouter_api_key: String(payload.openrouter_api_key ?? "").trim(),
      plan_type: (String(payload.plan_type ?? "free").trim().toLowerCase() || "free"),
      widget_key: String(payload.widget_key ?? "").trim(),
      created_at: nowIso(),
    };
    await this.col("bots").doc(String(id)).set(data);
    return botFromData(data)!;
  }

  async getBot(botId: number): Promise<BotRecord | null> {
    const snap = await this.col("bots").doc(String(botId)).get();
    return botFromData(snap.data());
  }

  async listBots(opts: { companyId: number }): Promise<BotRecord[]> {
    const snap = await this.col("bots").where("company_id", "==", Number(opts.companyId)).get();
    const rows = snap.docs.map((d) => botFromData(d.data())!).filter(Boolean);
    return sortByCreatedDesc(rows);
  }

  async listAllBots(): Promise<BotRecord[]> {
    const snap = await this.col("bots").get();
    const rows = snap.docs.map((d) => botFromData(d.data())!).filter(Boolean);
    return sortByCreatedDesc(rows);
  }

  async updateBot(botId: number, updates: Record<string, unknown>): Promise<void> {
    await this.col("bots").doc(String(botId)).set(updates, { merge: true });
  }

  async findBotByWidgetKey(widgetKey: string): Promise<BotRecord | null> {
    const key = String(widgetKey || "").trim();
    if (!key) return null;
    const snap = await this.col("bots").where("widget_key", "==", key).limit(1).get();
    if (snap.empty) return null;
    return botFromData(snap.docs[0].data());
  }

  // ---- Payments ----
  async createPayment(payload: Record<string, unknown>): Promise<PaymentRecord> {
    const id = await this.nextId("payments");
    const now = nowIso();
    const data = {
      id,
      company_id: Number(payload.company_id),
      admin_id: Number(payload.admin_id),
      bot_name: String(payload.bot_name ?? "").trim(),
      amount_pkr: asInt(payload.amount_pkr, 0),
      amount_usd: Number(payload.amount_usd ?? 0),
      currency: String(payload.currency ?? "PKR").toUpperCase(),
      payment_method: String(payload.payment_method ?? "card").toLowerCase(),
      card_type: payload.card_type != null && String(payload.card_type).trim() ? String(payload.card_type).toLowerCase() : null,
      provider: String(payload.provider ?? "sandbox").toLowerCase(),
      provider_intent_id: String(payload.provider_intent_id ?? "").trim(),
      status: String(payload.status ?? "pending").toLowerCase(),
      metadata: (payload.metadata as Record<string, unknown>) ?? {},
      created_at: now,
      updated_at: now,
      paid_at: payload.paid_at != null ? String(payload.paid_at) : null,
    };
    await this.col("payments").doc(String(id)).set(data);
    return paymentFromData(data)!;
  }

  async getPayment(paymentId: number): Promise<PaymentRecord | null> {
    const snap = await this.col("payments").doc(String(paymentId)).get();
    return paymentFromData(snap.data());
  }

  async updatePayment(paymentId: number, updates: Record<string, unknown>): Promise<void> {
    await this.col("payments").doc(String(paymentId)).set({ ...updates, updated_at: nowIso() }, { merge: true });
  }

  async findPaymentByProviderIntentId(providerIntentId: string): Promise<PaymentRecord | null> {
    const intent = String(providerIntentId || "").trim();
    if (!intent) return null;
    const snap = await this.col("payments").where("provider_intent_id", "==", intent).limit(1).get();
    if (snap.empty) return null;
    return paymentFromData(snap.docs[0].data());
  }

  // ---- Super-admin aggregates ----

  async computeSuperAdminAggregates(): Promise<SuperAdminAggregates> {
    const companies = await this.listCompanies();
    const companyIdSet = new Set(companies.map((c) => Number(c.id)));

    const [allBots, totalQueriesSnap, totalFallbackSnap, totalDocsSnap, totalAdminsSnap, superAdminSnap] =
      await Promise.all([
        this.listAllBots(),
        this.col("chat_messages").count().get(),
        this.col("chat_messages").where("fallback_used", "==", true).count().get(),
        this.col("documents").count().get(),
        this.col("admins").count().get(),
        this.col("admins").where("role", "==", "super_admin").count().get(),
      ]);

    const botsByCompany = new Map<number, number[]>();
    let totalBots = 0;
    for (const bot of allBots) {
      const cid = Number(bot.company_id);
      if (!companyIdSet.has(cid)) continue;
      totalBots += 1;
      const existing = botsByCompany.get(cid) || [];
      existing.push(Number(bot.id));
      botsByCompany.set(cid, existing);
    }

    const perCompany = await Promise.all(
      companies.map(async (company) => {
        const cid = Number(company.id);
        const companyBotIds = botsByCompany.get(cid) || [];
        const [adminSnap, docSnap, queryCount] = await Promise.all([
          this.col("admins").where("company_id", "==", cid).count().get(),
          this.col("documents").where("company_id", "==", cid).count().get(),
          this.countChatMessagesForBotIds(companyBotIds),
        ]);
        return {
          cid,
          adminCount: adminSnap.data().count,
          botCount: companyBotIds.length,
          docCount: docSnap.data().count,
          queryCount,
        };
      })
    );

    const adminCountByCompany: Record<number, number> = {};
    const botCountByCompany: Record<number, number> = {};
    const docCountByCompany: Record<number, number> = {};
    const queryCountByCompany: Record<number, number> = {};
    for (const row of perCompany) {
      adminCountByCompany[row.cid] = row.adminCount;
      botCountByCompany[row.cid] = row.botCount;
      docCountByCompany[row.cid] = row.docCount;
      queryCountByCompany[row.cid] = row.queryCount;
    }

    const totalDocs = totalDocsSnap.data().count;
    const totalQueries = totalQueriesSnap.data().count;
    const totalFallback = totalFallbackSnap.data().count;
    const totalNonSuperAdmins = Math.max(0, totalAdminsSnap.data().count - superAdminSnap.data().count);
    const fallbackRate = totalQueries > 0 ? totalFallback / totalQueries : 0.0;
    return {
      companies,
      overview_totals: {
        companies: companies.length,
        admins: totalNonSuperAdmins,
        bots: totalBots,
        documents: totalDocs,
        chat_queries: totalQueries,
        fallback_queries: totalFallback,
        fallback_rate: Math.round(fallbackRate * 10000) / 10000,
      },
      admin_count_by_company: adminCountByCompany,
      bot_count_by_company: botCountByCompany,
      document_count_by_company: docCountByCompany,
      query_count_by_company: queryCountByCompany,
    };
  }
}

export interface SuperAdminAggregates {
  companies: CompanyRecord[];
  overview_totals: {
    companies: number;
    admins: number;
    bots: number;
    documents: number;
    chat_queries: number;
    fallback_queries: number;
    fallback_rate: number;
  };
  admin_count_by_company: Record<number, number>;
  bot_count_by_company: Record<number, number>;
  document_count_by_company: Record<number, number>;
  query_count_by_company: Record<number, number>;
}

let repoSingleton: FirestoreRepository | null = null;

export function getRepo(): FirestoreRepository {
  if (!repoSingleton) repoSingleton = new FirestoreRepository();
  return repoSingleton;
}

export type { FirestoreRepository };
