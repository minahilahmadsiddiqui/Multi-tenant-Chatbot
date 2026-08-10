import "server-only";
import OpenAI from "openai";
import { env } from "../env";

function shouldRetry(err: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts - 1) return false;
  const status = (err as { status?: number })?.status;
  if (typeof status === "number" && [400, 401, 403, 404, 422].includes(status)) return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getEmbeddings(
  texts: string[],
  opts: { batchSize?: number } = {}
): Promise<number[][]> {
  const apiKey = String(env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY in server environment");

  const batchSize = opts.batchSize ?? env.EMBEDDING_BATCH_SIZE;
  const client = new OpenAI({
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL,
    timeout: env.OPENROUTER_EMBEDDING_TIMEOUT_SEC * 1000,
    maxRetries: 0,
    defaultHeaders: {
      "HTTP-Referer": env.OPENROUTER_REFERER,
      "X-Title": env.OPENROUTER_TITLE,
    },
  });
  const maxAttempts = Math.max(1, env.OPENROUTER_EMBEDDING_MAX_RETRIES);

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await client.embeddings.create({
          model: env.OPENROUTER_EMBEDDING_MODEL,
          input: batch,
        });
        for (const item of response.data) embeddings.push(item.embedding as number[]);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (!shouldRetry(e, attempt, maxAttempts)) throw e;
        await sleep(Math.min(32000, 2 ** (attempt + 1) * 1000));
      }
    }
    if (lastErr !== null) throw lastErr;
  }
  return embeddings;
}
