import "server-only";
import crypto from "crypto";
import { getRepo } from "../repository";
import { authenticate, requireAdmin } from "../auth";
import { resolveCompanyScope, resolveBotScope } from "../tenant";
import { json, errorResponse, isTruthyFlag, parseIntOrNull } from "../http";
import { env } from "../env";
import { extractTextFromUpload } from "../rag/documentParser";
import {
  normalizeHandbookText,
  handbookHasSectionMarkers,
  handbookHasAutoStructure,
  splitHandbookIntoEmbeddingChunks,
  splitAutoStructuredIntoEmbeddingChunks,
  normalizeText,
  splitTextIntoTokenChunks,
  type ChunkTuple,
} from "../rag/textSplitter";
import { getEmbeddings } from "../rag/embeddings";
import { getQdrant, formatQdrantDeleteError } from "../rag/qdrant";
import { invalidateBotWorkspaceServerCache } from "../workspaceCache";

function contentHashFor(normalized: string, chunkSize: number, overlap: number): string {
  // Deterministic JSON with keys in sorted order (mirrors json.dumps sort_keys=True).
  const fingerprint = JSON.stringify({
    chunk_size_tokens: chunkSize,
    embedding_model: env.OPENROUTER_EMBEDDING_MODEL,
    ingest_version: "v2",
    overlap_tokens: overlap,
    text: normalized,
  });
  return crypto.createHash("sha256").update(fingerprint, "utf-8").digest("hex");
}

export async function handleUploadDocument(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const contentType = request.headers.get("content-type") || "";

    let rawText = "";
    let fileName = "";
    let fileBuffer: Buffer | null = null;
    let nameField = "";
    let forceReindexRaw: unknown = "";
    const body: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const textVal = form.get("text");
      rawText = textVal != null ? String(textVal) : "";
      nameField = form.get("name") != null ? String(form.get("name")) : "";
      forceReindexRaw = form.get("force_reindex");
      if (form.get("bot_id") != null) body.bot_id = String(form.get("bot_id"));
      if (form.get("company_id") != null) body.company_id = String(form.get("company_id"));
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        fileBuffer = Buffer.from(await (file as File).arrayBuffer());
        fileName = (file as File).name || "uploaded_text";
      }
    } else {
      const parsed = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      Object.assign(body, parsed);
      rawText = parsed.text != null ? String(parsed.text) : "";
      nameField = parsed.name != null ? String(parsed.name) : "";
      forceReindexRaw = parsed.force_reindex;
    }

    if (rawText && fileBuffer) {
      return json({ error: "Provide either 'text' or 'file', not both." }, 400);
    }

    const { companyId, bot } = await resolveBotScope(user, { searchParams: url.searchParams, body });
    const repo = getRepo();

    let content: string;
    let docName: string;
    if (fileBuffer) {
      content = (await extractTextFromUpload(fileName, fileBuffer)) || "";
      if (!content) {
        return json(
          { error: "Unsupported or unreadable file. Supported formats: .txt, .pdf, .docx" },
          400
        );
      }
      docName = nameField || fileName || "uploaded_text";
    } else {
      content = String(rawText || "");
      if (!content.trim()) return json({ error: "No text provided." }, 400);
      docName = nameField || "raw_text";
    }

    const handbookNorm = normalizeHandbookText(content);
    const useExplicit = handbookHasSectionMarkers(handbookNorm);
    const useAuto = !useExplicit && handbookHasAutoStructure(handbookNorm);

    const chunkSize = env.RAG_INGEST_CHUNK_SIZE_TOKENS;
    const overlap = env.RAG_INGEST_CHUNK_OVERLAP_TOKENS;
    const embeddingBatchSize = env.EMBEDDING_BATCH_SIZE;

    let handbookRows: ChunkTuple[] = [];
    if (useExplicit) handbookRows = splitHandbookIntoEmbeddingChunks(handbookNorm, chunkSize, overlap);
    else if (useAuto) handbookRows = splitAutoStructuredIntoEmbeddingChunks(handbookNorm, chunkSize, overlap);

    let normalized: string;
    let chunks: string[];
    let tokenCounts: number[];

    if (handbookRows.length) {
      normalized = handbookNorm;
      chunks = handbookRows.map((r) => r[0]);
      tokenCounts = handbookRows.map((r) => r[1]);
    } else {
      normalized = normalizeText(content);
      if (!normalized) return json({ error: "Text is empty after normalization." }, 400);
      const [c, t] = splitTextIntoTokenChunks(normalized, chunkSize, overlap);
      chunks = c;
      tokenCounts = t;
    }

    const contentHash = contentHashFor(normalized, chunkSize, overlap);
    const existing = await repo.findDocumentByContentHash(contentHash, { companyId, botId: bot.id });
    const forceReindex = isTruthyFlag(forceReindexRaw);

    if (existing) {
      if (forceReindex) {
        await getQdrant().deleteByDocId(existing.id, {
          companyId,
          botId: bot.id,
          chunkCount: existing.chunk_count,
        });
        await repo.deleteDocument(existing.id);
      } else {
        return json(
          {
            message: "Document already exists",
            document_id: existing.id,
            chunk_count: existing.chunk_count,
            token_count: existing.token_count,
            embedding_count: existing.embedding_count,
            status: existing.status,
          },
          200
        );
      }
    }

    if (!chunks.length) return json({ error: "Unable to chunk provided text." }, 400);

    const chunkCount = chunks.length;
    const tokenCount = tokenCounts.reduce((a, b) => a + b, 0);
    const embeddingCount = chunkCount;
    if (!String(env.OPENROUTER_API_KEY || "").trim()) {
      return json(
        { error: "Server OpenRouter API key is not configured. Set OPENROUTER_API_KEY in the environment." },
        500
      );
    }

    const doc = await repo.createDocument({
      name: docName,
      company_id: companyId,
      bot_id: bot.id,
      content_hash: contentHash,
      content_length: normalized.length,
      chunk_count: chunkCount,
      token_count: tokenCount,
      embedding_count: embeddingCount,
      status: "processing",
    });

    try {
      const embeddings = await getEmbeddings(chunks, {
        batchSize: embeddingBatchSize,
      });
      if (embeddings.length !== chunkCount) throw new Error("Embeddings returned unexpected count.");

      const points = chunks.map((chunkText, i) => ({
        id: doc.id * 1_000_000 + i,
        vector: embeddings[i],
        payload: {
          doc_id: doc.id,
          company_id: companyId,
          bot_id: bot.id,
          chunk_index: i,
          chunk_id: `${doc.id}_${i}`,
          text: chunkText,
          token_count: tokenCounts[i],
        },
      }));

      await getQdrant().addEmbeddings(points);
      await repo.updateDocument(doc.id, { status: "ready", error_message: "" });
      invalidateBotWorkspaceServerCache(companyId, bot.id);
      return json(
        {
          message: "Ingested successfully",
          document_id: doc.id,
          chunk_count: chunkCount,
          token_count: tokenCount,
          embedding_count: embeddingCount,
          status: "ready",
        },
        201
      );
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      await repo.updateDocument(doc.id, { status: "error", error_message: msg });
      if (msg.toLowerCase().includes("vector dimension mismatch") || msg.toLowerCase().includes("vector dimension error")) {
        return json(
          {
            error: msg,
            hint:
              "Embedding dimension and Qdrant collection size must match. Set QDRANT_VECTOR_SIZE to your " +
              "model dimension and use a fresh QDRANT_COLLECTION_NAME (or recreate the collection).",
          },
          400
        );
      }
      const status = (e as { status?: number })?.status;
      if (status === 401) {
        return json(
          {
            error: "Embedding API authentication failed.",
            details: msg,
            hint:
              "Set a valid OPENROUTER_API_KEY in the server environment (https://openrouter.ai/keys). " +
              'Invalid, expired, or revoked keys return "User not found" from the provider.',
          },
          502
        );
      }
      return errorResponse(e);
    }
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleListDocuments(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const companyId = await resolveCompanyScope(user, { searchParams: url.searchParams });
    const repo = getRepo();
    const botId = parseIntOrNull(url.searchParams.get("bot_id"));
    let documents;
    if (botId !== null) {
      const bot = await repo.getBot(botId);
      if (!bot || Number(bot.company_id) !== Number(companyId)) {
        return json({ error: "Bot not found." }, 404);
      }
      documents = await repo.listDocumentsForBot({ companyId, botId });
    } else {
      documents = await repo.listDocuments({ companyId });
    }
    return json(
      documents.map((doc) => ({
        id: doc.id,
        bot_id: doc.bot_id,
        name: doc.name,
        chunk_count: doc.chunk_count,
        embedding_count: doc.embedding_count,
        token_count: doc.token_count,
        status: doc.status,
        created_at: doc.created_at,
      }))
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleDeleteDocument(request: Request, docId: string) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const { companyId, bot } = await resolveBotScope(user, { searchParams: url.searchParams });
    const repo = getRepo();
    const id = parseIntOrNull(docId);
    const doc = id !== null ? await repo.getDocument(id) : null;
    if (!doc) return json({ error: "Document not found" }, 404);
    if (Number(doc.company_id ?? -1) !== Number(companyId)) return json({ error: "Document not found" }, 404);
    if (Number(doc.bot_id ?? -1) !== Number(bot.id)) return json({ error: "Document not found" }, 404);

    try {
      await getQdrant().deleteByDocId(Number(id), {
        companyId,
        botId: bot.id,
        chunkCount: doc.chunk_count,
      });
    } catch (e) {
      const err = formatQdrantDeleteError(e);
      return json(err.body, err.status);
    }
    await repo.deleteDocument(Number(id));
    invalidateBotWorkspaceServerCache(companyId, bot.id);
    return json({ message: "Deleted successfully" });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleGetStats(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const companyId = await resolveCompanyScope(user, { searchParams: url.searchParams });
    const repo = getRepo();
    const botId = parseIntOrNull(url.searchParams.get("bot_id"));
    if (botId !== null) {
      const bot = await repo.getBot(botId);
      if (!bot || Number(bot.company_id) !== Number(companyId)) {
        return json({ error: "Bot not found." }, 404);
      }
      const docs = await repo.listDocumentsForBot({ companyId, botId });
      return json({
        total_documents: docs.length,
        total_chunks: docs.reduce((a, d) => a + (d.chunk_count || 0), 0),
        total_vector_embeddings: docs.reduce((a, d) => a + (d.embedding_count || 0), 0),
        total_tokens: docs.reduce((a, d) => a + (d.token_count || 0), 0),
      });
    }
    return json(await repo.getStats({ companyId }));
  } catch (e) {
    return errorResponse(e);
  }
}
