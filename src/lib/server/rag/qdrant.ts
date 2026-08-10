import "server-only";
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../env";

export interface QdrantPoint {
  id: number | string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface ScoredPoint {
  id: number | string;
  score: number | null;
  payload: Record<string, unknown>;
}

type Filter = Record<string, unknown>;

function isQdrantConnectivityError(e: unknown): boolean {
  const msg = String((e as Error)?.message || e).toLowerCase();
  const cause = String((e as { cause?: unknown })?.cause ?? "").toLowerCase();
  const combined = `${msg} ${cause}`;
  return (
    combined.includes("fetch failed") ||
    combined.includes("econnrefused") ||
    combined.includes("enotfound") ||
    combined.includes("network") ||
    combined.includes("unable to connect") ||
    combined.includes("socket hang up")
  );
}

function isQdrantNotFoundError(e: unknown): boolean {
  const msg = String((e as Error)?.message || e).toLowerCase();
  const status = Number((e as { status?: number })?.status);
  return status === 404 || msg.includes("not found") || msg.includes("doesn't exist");
}

export function formatQdrantDeleteError(e: unknown): { status: number; body: Record<string, unknown> } {
  const details = String((e as Error)?.message || e);
  if (isQdrantConnectivityError(e)) {
    return {
      status: 503,
      body: {
        error: `Cannot connect to Qdrant at ${env.QDRANT_URL || "(not set)"}.`,
        details,
        hint:
          "Set QDRANT_URL and QDRANT_API_KEY in .env to your Qdrant Cloud cluster " +
          "(https://cloud.qdrant.io) or a local instance (docker run -p 6333:6333 qdrant/qdrant).",
      },
    };
  }
  return {
    status: 400,
    body: {
      error: "Failed to delete vectors from Qdrant.",
      details,
    },
  };
}

export interface DeleteByDocIdOpts {
  chunkCount?: number | null;
  companyId?: number | null;
  botId?: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;
  private vectorSize: number;
  private validateVectorDimension: boolean;
  private vectorUsing: string | null;
  private ready: Promise<void> | null = null;

  constructor(opts: { validateVectorDimension?: boolean } = {}) {
    this.client = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
      timeout: env.QDRANT_TIMEOUT_SEC * 1000,
      checkCompatibility: false,
    });
    this.collectionName = env.QDRANT_COLLECTION_NAME;
    this.vectorSize = env.QDRANT_VECTOR_SIZE;
    this.validateVectorDimension = opts.validateVectorDimension ?? true;
    this.vectorUsing = env.QDRANT_VECTOR_NAME;
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.ensureCollection();
    return this.ready;
  }

  private async collectionExists(): Promise<boolean> {
    try {
      const res = await this.client.getCollections();
      return res.collections.some((c) => c.name === this.collectionName);
    } catch {
      return false;
    }
  }

  private readVectorsConfig(info: unknown): Record<string, unknown> | { size?: number } | null {
    const cfg = (info as { config?: { params?: { vectors?: unknown } } })?.config?.params?.vectors;
    return (cfg as Record<string, unknown>) ?? null;
  }

  private resolveVectorUsingFromConfig(vectors: unknown): string | null {
    if (env.QDRANT_VECTOR_NAME) return env.QDRANT_VECTOR_NAME;
    if (!vectors || typeof vectors !== "object") return null;
    if ("size" in (vectors as Record<string, unknown>)) return null; // unnamed
    const names = Object.keys(vectors as Record<string, unknown>);
    if (names.length === 1) return names[0];
    if (names.length > 1) {
      for (const cand of ["default", "dense", "text", "embedding"]) {
        if (names.includes(cand)) return cand;
      }
      return names[0];
    }
    return null;
  }

  private readExistingVectorSize(vectors: unknown): number | null {
    if (!vectors || typeof vectors !== "object") return null;
    const v = vectors as Record<string, unknown>;
    if ("size" in v) return Number(v.size);
    if (this.vectorUsing && this.vectorUsing in v) {
      return Number((v[this.vectorUsing] as { size?: number })?.size);
    }
    const first = Object.values(v)[0] as { size?: number } | undefined;
    return first?.size != null ? Number(first.size) : null;
  }

  private async ensureCollection(): Promise<void> {
    const exists = await this.collectionExists();
    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: { size: this.vectorSize, distance: "Cosine" },
      });
    } else {
      const info = await this.client.getCollection(this.collectionName);
      const vectors = this.readVectorsConfig(info);
      const existingDim = this.readExistingVectorSize(vectors);
      this.vectorUsing = this.resolveVectorUsingFromConfig(vectors);
      if (this.validateVectorDimension && existingDim != null && existingDim !== this.vectorSize) {
        if (env.QDRANT_AUTO_RECREATE_ON_DIMENSION_MISMATCH) {
          await this.client.deleteCollection(this.collectionName);
          await this.client.createCollection(this.collectionName, {
            vectors: { size: this.vectorSize, distance: "Cosine" },
          });
        } else {
          throw new Error(
            `Qdrant vector dimension mismatch for collection '${this.collectionName}': ` +
              `existing=${existingDim}, configured=${this.vectorSize}. ` +
              "Use a new QDRANT_COLLECTION_NAME, recreate the collection, or set " +
              "QDRANT_AUTO_RECREATE_ON_DIMENSION_MISMATCH=1 (destructive)."
          );
        }
      }
    }

    for (const field of ["doc_id", "company_id", "bot_id"]) {
      try {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: field,
          field_schema: "integer",
        });
      } catch {
        /* index may already exist */
      }
    }
  }

  private wrapVector(embedding: number[]): number[] | Record<string, number[]> {
    if (this.vectorUsing) return { [this.vectorUsing]: embedding };
    return embedding;
  }

  private buildScopeFilter(opts: {
    companyId?: number | null;
    botId?: number | null;
    docIds?: number[] | null;
  }): Filter | undefined {
    const must: Record<string, unknown>[] = [];
    if (opts.companyId != null) must.push({ key: "company_id", match: { value: Number(opts.companyId) } });
    if (opts.botId != null) must.push({ key: "bot_id", match: { value: Number(opts.botId) } });
    const docValues = (opts.docIds || []).filter((v) => v != null).map(Number);
    if (docValues.length) must.push({ key: "doc_id", match: { any: docValues } });
    if (!must.length) return undefined;
    return { must };
  }

  async addEmbeddings(points: QdrantPoint[]): Promise<void> {
    await this.ensureReady();
    if (!points.length) return;
    const wrapped = points.map((p) => ({
      id: p.id,
      vector: this.wrapVector(p.vector),
      payload: p.payload || {},
    }));

    const batchSize = Math.max(1, env.QDRANT_UPSERT_BATCH_SIZE);
    const retries = env.QDRANT_UPSERT_RETRIES;
    const initialBackoff = env.QDRANT_UPSERT_RETRY_BACKOFF_SEC;

    for (let i = 0; i < wrapped.length; i += batchSize) {
      const chunk = wrapped.slice(i, i + batchSize);
      let attempt = 0;
      for (;;) {
        try {
          await this.client.upsert(this.collectionName, { wait: true, points: chunk as never });
          break;
        } catch (e) {
          if (attempt >= retries) throw e;
          await sleep(Math.min(initialBackoff * 2 ** attempt, 8) * 1000);
          attempt += 1;
        }
      }
    }
  }

  async search(
    queryVector: number[],
    opts: { limit?: number; companyId?: number | null; botId?: number | null; docIds?: number[] | null } = {}
  ): Promise<ScoredPoint[]> {
    await this.ensureReady();
    const filter = this.buildScopeFilter(opts);
    const limit = opts.limit ?? 5;
    const res = await this.client.query(this.collectionName, {
      query: queryVector,
      limit,
      using: this.vectorUsing ?? undefined,
      filter,
      with_payload: true,
    });
    const points = (res.points || []) as Array<{ id: number | string; score?: number; payload?: Record<string, unknown> }>;
    return points.map((p) => ({
      id: p.id,
      score: p.score ?? null,
      payload: p.payload || {},
    }));
  }

  async scanPayloadPoints(
    opts: {
      limit?: number;
      maxPoints?: number | null;
      companyId?: number | null;
      botId?: number | null;
      docIds?: number[] | null;
    } = {}
  ): Promise<Array<{ id: number | string; payload: Record<string, unknown> }>> {
    await this.ensureReady();
    const limit = opts.limit ?? 256;
    const cap = opts.maxPoints != null ? opts.maxPoints : limit;
    const filter = this.buildScopeFilter(opts);
    const batch = Math.max(1, Math.min(limit, 256));
    const out: Array<{ id: number | string; payload: Record<string, unknown> }> = [];
    let offset: number | string | Record<string, unknown> | null | undefined = undefined;

    while (out.length < cap) {
      const take = Math.min(batch, cap - out.length);
      let result;
      try {
        result = await this.client.scroll(this.collectionName, {
          with_payload: true,
          with_vector: false,
          limit: take,
          offset: offset as never,
          filter,
        });
      } catch {
        break;
      }
      const points = (result.points || []) as Array<{ id: number | string; payload?: Record<string, unknown> }>;
      offset = result.next_page_offset as typeof offset;
      if (!points.length) break;
      for (const p of points) out.push({ id: p.id, payload: p.payload || {} });
      if (offset == null) break;
    }
    return out;
  }

  async deleteByDocId(documentId: number, opts: DeleteByDocIdOpts = {}): Promise<void> {
    if (!String(env.QDRANT_URL || "").trim()) {
      throw new Error("QDRANT_URL is not configured.");
    }

    try {
      await this.ensureReady();
    } catch (e) {
      if (isQdrantNotFoundError(e)) return;
      throw e;
    }

    const docId = Number(documentId);
    const must: Record<string, unknown>[] = [{ key: "doc_id", match: { value: docId } }];
    if (opts.companyId != null) must.push({ key: "company_id", match: { value: Number(opts.companyId) } });
    if (opts.botId != null) must.push({ key: "bot_id", match: { value: Number(opts.botId) } });

    const filterDelete = async () => {
      await this.client.delete(this.collectionName, {
        filter: { must },
        wait: true,
      });
    };

    const chunkCount = Math.max(0, Number(opts.chunkCount ?? 0));
    const pointIdDelete = async () => {
      if (chunkCount <= 0) return;
      const pointIds = Array.from({ length: chunkCount }, (_, i) => docId * 1_000_000 + i);
      const batchSize = 256;
      for (let i = 0; i < pointIds.length; i += batchSize) {
        await this.client.delete(this.collectionName, {
          points: pointIds.slice(i, i + batchSize),
          wait: true,
        });
      }
    };

    const scrollDelete = async () => {
      const points = await this.scanPayloadPoints({
        companyId: opts.companyId,
        botId: opts.botId,
        docIds: [docId],
        maxPoints: 100_000,
      });
      if (!points.length) return;
      const ids = points.map((p) => p.id);
      const batchSize = 256;
      for (let i = 0; i < ids.length; i += batchSize) {
        await this.client.delete(this.collectionName, {
          points: ids.slice(i, i + batchSize),
          wait: true,
        });
      }
    };

    let lastErr: unknown = null;
    for (const attempt of [filterDelete, pointIdDelete, scrollDelete]) {
      try {
        await attempt();
        return;
      } catch (e) {
        if (isQdrantNotFoundError(e)) return;
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
  }
}

let qdrantSingleton: QdrantService | null = null;

export function getQdrant(): QdrantService {
  if (!qdrantSingleton) qdrantSingleton = new QdrantService();
  return qdrantSingleton;
}
