import "server-only";
import {
  DEFAULT_CHAT_MODEL,
  isChatProvider,
  normalizeChatModel,
  type ChatProvider,
} from "../modelCatalog";

export interface ResolvedBotChatConfig {
  provider: ChatProvider;
  model: string;
  chatApiKey: string;
}

export function resolveBotChatConfig(bot: {
  chat_provider?: string;
  chat_model?: string;
  chat_api_key?: string;
}): ResolvedBotChatConfig {
  const provider: ChatProvider = isChatProvider(bot.chat_provider) ? bot.chat_provider : "openrouter";
  const model = normalizeChatModel(provider, bot.chat_model);
  const chatApiKey = String(bot.chat_api_key || "").trim();
  return { provider, model, chatApiKey };
}

export function defaultBotModelFields(): {
  chat_provider: ChatProvider;
  chat_model: string;
  chat_api_key: string;
} {
  return {
    chat_provider: "openrouter",
    chat_model: DEFAULT_CHAT_MODEL.openrouter,
    chat_api_key: "",
  };
}
