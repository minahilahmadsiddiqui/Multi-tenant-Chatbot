import "server-only";
import { env } from "./env";
import { createOpenAiCompatibleClient } from "./llmClient";
import type { ChatProvider } from "../modelCatalog";

export interface ProviderModelOption {
  id: string;
  label: string;
}

function sortModels(models: ProviderModelOption[]): ProviderModelOption[] {
  return [...models].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

function humanizeModelId(id: string): string {
  const raw = String(id || "").trim();
  if (!raw) return "Unknown model";
  const tail = raw.includes("/") ? raw.split("/").pop() || raw : raw;
  return tail.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const OPENAI_BLOCKLIST = /(embed|embedding|whisper|tts|dall-e|davinci|babbage|moderation|realtime|audio|transcribe)/i;

async function listOpenAiModels(apiKey: string): Promise<ProviderModelOption[]> {
  const client = createOpenAiCompatibleClient("openai", apiKey);
  const page = await client.models.list();
  const models: ProviderModelOption[] = [];
  for (const item of page.data) {
    const id = String(item.id || "").trim();
    if (!id || OPENAI_BLOCKLIST.test(id)) continue;
    if (!/^(gpt-|o\d|chatgpt)/i.test(id)) continue;
    models.push({ id, label: humanizeModelId(id) });
  }
  return sortModels(models);
}

async function listGoogleModels(apiKey: string): Promise<ProviderModelOption[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Google models request failed with status ${response.status}`);
  }
  const data = (await response.json()) as {
    models?: Array<{
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }>;
  };
  const models: ProviderModelOption[] = [];
  for (const item of data.models || []) {
    const name = String(item.name || "").trim();
    const methods = item.supportedGenerationMethods || [];
    if (!methods.includes("generateContent")) continue;
    const id = name.replace(/^models\//, "");
    if (!id || !/gemini/i.test(id)) continue;
    models.push({
      id,
      label: String(item.displayName || "").trim() || humanizeModelId(id),
    });
  }
  return sortModels(models);
}

async function listAnthropicModels(apiKey: string): Promise<ProviderModelOption[]> {
  const response = await fetch("https://api.anthropic.com/v1/models", {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Anthropic models request failed with status ${response.status}`);
  }
  const data = (await response.json()) as {
    data?: Array<{ id?: string; display_name?: string; type?: string }>;
  };
  const models: ProviderModelOption[] = [];
  for (const item of data.data || []) {
    const id = String(item.id || "").trim();
    if (!id) continue;
    if (item.type && item.type !== "model") continue;
    models.push({
      id,
      label: String(item.display_name || "").trim() || humanizeModelId(id),
    });
  }
  return sortModels(models);
}

const OPENROUTER_PROVIDER_PREFIX: Record<Exclude<ChatProvider, "openrouter">, string> = {
  openai: "openai/",
  google: "google/",
  anthropic: "anthropic/",
};

function isOpenRouterChatModel(raw: Record<string, unknown>): boolean {
  const id = String(raw.id || "").trim();
  if (!id) return false;
  const modality = String((raw.architecture as { modality?: string } | undefined)?.modality || "").toLowerCase();
  if (modality && !modality.includes("text")) return false;
  const name = String(raw.name || id).toLowerCase();
  if (/(embed|embedding|whisper|tts|dall-e|image|audio|moderation)/i.test(`${id} ${name}`)) return false;
  return true;
}

async function listOpenRouterModels(apiKey: string, providerFilter?: ChatProvider): Promise<ProviderModelOption[]> {
  const response = await fetch(`${env.OPENROUTER_BASE_URL.replace(/\/$/, "")}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": env.OPENROUTER_REFERER,
      "X-Title": env.OPENROUTER_TITLE,
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `OpenRouter models request failed with status ${response.status}`);
  }
  const data = (await response.json()) as { data?: Array<Record<string, unknown>> };
  const prefix =
    providerFilter && providerFilter !== "openrouter" ? OPENROUTER_PROVIDER_PREFIX[providerFilter] : null;

  const models: ProviderModelOption[] = [];
  for (const item of data.data || []) {
    if (!isOpenRouterChatModel(item)) continue;
    const id = String(item.id || "").trim();
    if (prefix && !id.startsWith(prefix)) continue;
    models.push({
      id,
      label: String(item.name || "").trim() || humanizeModelId(id),
    });
  }
  return sortModels(models);
}

export async function listProviderModels(provider: ChatProvider, apiKey: string): Promise<ProviderModelOption[]> {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("API key is required to load models.");

  switch (provider) {
    case "openai":
      return listOpenAiModels(key);
    case "google":
      return listGoogleModels(key);
    case "anthropic":
      return listAnthropicModels(key);
    case "openrouter":
      return listOpenRouterModels(key);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
