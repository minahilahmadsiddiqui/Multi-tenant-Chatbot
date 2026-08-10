/**
 * Verify Qdrant Cloud (or self-hosted) connectivity using .env credentials.
 * Usage: npm run qdrant:check
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const url = (process.env.QDRANT_URL || "").replace(/\/$/, "");
const apiKey = process.env.QDRANT_API_KEY || "";
const collection = process.env.QDRANT_COLLECTION_NAME || "documents";

if (!url) {
  console.error("QDRANT_URL is not set. Add your Qdrant Cloud cluster endpoint to .env");
  console.error("Example: QDRANT_URL=https://xxxx.us-east-1-0.aws.cloud.qdrant.io");
  process.exit(1);
}

if (url.includes("localhost") && !apiKey) {
  console.log("Using local Qdrant at", url);
} else if (!apiKey) {
  console.error("QDRANT_API_KEY is required for Qdrant Cloud.");
  console.error("Create a key at https://cloud.qdrant.io → your cluster → API Keys");
  process.exit(1);
}

const headers = { Accept: "application/json" };
if (apiKey) headers["api-key"] = apiKey;

async function get(path) {
  const res = await fetch(`${url}${path}`, { headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

try {
  const health = await get("/healthz");
  if (!health.ok) {
    console.error("Health check failed:", health.status, health.body);
    process.exit(1);
  }
  console.log("OK  Qdrant health:", url);

  const collections = await get("/collections");
  if (!collections.ok) {
    console.error("Failed to list collections:", collections.status, collections.body);
    process.exit(1);
  }

  const names = (collections.body?.result?.collections || []).map((c) => c.name);
  console.log("OK  Collections:", names.length ? names.join(", ") : "(none yet)");

  if (names.includes(collection)) {
    const info = await get(`/collections/${encodeURIComponent(collection)}`);
    if (info.ok) {
      const count = info.body?.result?.points_count ?? "?";
      console.log(`OK  Collection "${collection}" has ${count} vector(s)`);
    }
  } else {
    console.log(
      `Note: "${collection}" does not exist yet — it will be created on first document ingest.`
    );
  }
} catch (err) {
  console.error("Connection error:", err.message || err);
  console.error("Check QDRANT_URL, QDRANT_API_KEY, and that the cluster is running.");
  process.exit(1);
}
