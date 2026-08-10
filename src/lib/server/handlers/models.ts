import "server-only";
import { authenticate, requireAdmin } from "../auth";
import { json, readJson, errorResponse, mapExternalApiError } from "../http";
import { isChatProvider } from "../../modelCatalog";
import { listProviderModels } from "../providerModels";

export async function handleListProviderModels(request: Request) {
  try {
    requireAdmin(await authenticate(request));
    const body = await readJson(request);
    const providerRaw = String(body.provider ?? body.chat_provider ?? "").trim().toLowerCase();
    if (!isChatProvider(providerRaw)) {
      return json({ error: "provider must be one of: openai, google, anthropic, openrouter." }, 400);
    }
    const apiKey = String(body.chat_api_key ?? body.api_key ?? "").trim();
    if (!apiKey) {
      return json({ error: "chat_api_key is required to load models." }, 400);
    }

    const models = await listProviderModels(providerRaw, apiKey);
    return json({ models, provider: providerRaw });
  } catch (e) {
    const mapped = mapExternalApiError(e, "Failed to load models");
    if (mapped) return errorResponse(mapped);
    return errorResponse(e);
  }
}
