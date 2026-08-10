import "server-only";
import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { env } from "./env";
import type { ChatProvider } from "../modelCatalog";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function createOpenAiCompatibleClient(provider: ChatProvider, apiKey: string): OpenAI {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("Missing chat API key");

  if (provider === "openai") {
    return new OpenAI({
      apiKey: key,
      timeout: env.OPENROUTER_HTTP_TIMEOUT_SEC * 1000,
      maxRetries: 0,
    });
  }

  if (provider === "google") {
    return new OpenAI({
      apiKey: key,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      timeout: env.OPENROUTER_HTTP_TIMEOUT_SEC * 1000,
      maxRetries: 0,
    });
  }

  if (provider === "openrouter") {
    return new OpenAI({
      apiKey: key,
      baseURL: env.OPENROUTER_BASE_URL,
      timeout: env.OPENROUTER_HTTP_TIMEOUT_SEC * 1000,
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": env.OPENROUTER_REFERER,
        "X-Title": env.OPENROUTER_TITLE,
      },
    });
  }

  throw new Error(`Provider ${provider} does not use the OpenAI-compatible client`);
}

async function anthropicChatCompletion(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<ChatCompletion> {
  const system = opts.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();
  const conversation = opts.messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.max_tokens ?? env.OPENROUTER_MAX_OUTPUT_TOKENS,
      system: system || undefined,
      messages: conversation.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      temperature: opts.temperature,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Anthropic request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
  };
  const text = (data.content || [])
    .filter((part) => part.type === "text")
    .map((part) => String(part.text || ""))
    .join("")
    .trim();

  return {
    id: "anthropic-completion",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: opts.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text, refusal: null },
        finish_reason: data.stop_reason === "max_tokens" ? "length" : "stop",
        logprobs: null,
      },
    ],
  } as ChatCompletion;
}

export async function createChatCompletion(opts: {
  provider: ChatProvider;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<ChatCompletion> {
  if (opts.provider === "anthropic") {
    return anthropicChatCompletion(opts);
  }

  const client = createOpenAiCompatibleClient(opts.provider, opts.apiKey);
  return client.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature,
    max_tokens: opts.max_tokens,
  });
}
