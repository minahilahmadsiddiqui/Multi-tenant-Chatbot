export type ChatProvider = "openai" | "google" | "anthropic" | "openrouter";

export interface ChatModelOption {
  id: string;
  label: string;
}

export const CHAT_PROVIDERS: { id: ChatProvider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
];

export const CHAT_MODELS_BY_PROVIDER: Record<ChatProvider, ChatModelOption[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "o3-mini", label: "o3-mini" },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  ],
  openrouter: [
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "openai/gpt-4o", label: "GPT-4o" },
    { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct" },
  ],
};

export const DEFAULT_CHAT_MODEL: Record<ChatProvider, string> = {
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-20241022",
  openrouter: "google/gemini-2.5-flash",
};

const PROVIDER_SET = new Set<string>(CHAT_PROVIDERS.map((p) => p.id));

export function isChatProvider(value: unknown): value is ChatProvider {
  return typeof value === "string" && PROVIDER_SET.has(value);
}

export function providerApiKeyLabel(provider: ChatProvider): string {
  switch (provider) {
    case "openai":
      return "OpenAI API Key";
    case "google":
      return "Google API Key";
    case "anthropic":
      return "Anthropic API Key";
    case "openrouter":
      return "OpenRouter API Key";
    default:
      return "API Key";
  }
}

export function providerApiKeyPlaceholder(provider: ChatProvider): string {
  switch (provider) {
    case "openai":
      return "sk-...";
    case "google":
      return "AIza...";
    case "anthropic":
      return "sk-ant-...";
    case "openrouter":
      return "sk-or-v1-...";
    default:
      return "Paste your API key";
  }
}

export function listModelsForProvider(provider: ChatProvider): ChatModelOption[] {
  return CHAT_MODELS_BY_PROVIDER[provider] || [];
}

export function normalizeChatModel(provider: ChatProvider, model: unknown): string {
  const raw = String(model ?? "").trim();
  if (raw) return raw;
  return DEFAULT_CHAT_MODEL[provider];
}
