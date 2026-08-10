import "server-only";
import { getRepo } from "../repository";
import { json, errorResponse } from "../http";
import { buildWidgetJs } from "../widget/embed";

export async function handlePublicWidgetConfig(request: Request) {
  try {
    const url = new URL(request.url);
    const widgetKey = String(url.searchParams.get("widget_key") ?? "").trim();
    if (!widgetKey) return json({ error: "widget_key is required." }, 400);
    const repo = getRepo();
    const bot = await repo.findBotByWidgetKey(widgetKey);
    if (!bot) return json({ error: "Invalid widget key." }, 404);

    const docs = await repo.listDocumentsForBot({ companyId: Number(bot.company_id), botId: Number(bot.id) });
    const prompt = String(bot.system_prompt || "").trim();
    let firstLine = "";
    if (prompt) {
      for (const line of prompt.split(/\r?\n/)) {
        const cleaned = line.trim();
        if (cleaned) {
          firstLine = cleaned;
          break;
        }
      }
    }
    if (firstLine.length > 220) firstLine = firstLine.slice(0, 220).replace(/\s+$/, "") + "...";

    let promptPreview = firstLine;
    const lowered = promptPreview.toLowerCase();
    if (lowered.startsWith("you are ")) promptPreview = promptPreview.slice(8).trim();
    if (lowered.startsWith("you are an ")) promptPreview = promptPreview.slice(11).trim();
    if (lowered.startsWith("you are a ")) promptPreview = promptPreview.slice(10).trim();
    if (promptPreview.toLowerCase().startsWith("the ")) promptPreview = promptPreview.slice(4).trim();
    if (promptPreview.toLowerCase().endsWith("for this company.")) {
      promptPreview = promptPreview.slice(0, -"for this company.".length).trim();
    }
    if (promptPreview.toLowerCase().endsWith("for this company")) {
      promptPreview = promptPreview.slice(0, -"for this company".length).trim();
    }
    if (promptPreview && !promptPreview.endsWith(".")) promptPreview = `${promptPreview}.`;

    const welcomeMessage = promptPreview
      ? `Hi! I'm ${bot.name}. I can help with ${promptPreview}`
      : `Hi! I'm ${bot.name}. Ask me anything related to your company's uploaded knowledge base.`;

    return json({
      bot_id: Number(bot.id),
      bot_name: bot.name,
      document_count: docs.length,
      welcome_message: welcomeMessage,
      theme: {
        navy_deep: "hsl(226,55%,10%)",
        navy: "hsl(226,45%,20%)",
        navy_light: "hsl(226,35%,30%)",
        mint: "hsl(160,62%,55%)",
        mint_light: "hsl(160,55%,92%)",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export function handlePublicWidgetScript(request: Request): Response {
  const url = new URL(request.url);
  const base = url.origin.replace(/\/$/, "");
  const chatUrl = `${base}/api/public/chat/query/`;
  const configUrl = `${base}/api/public/widget/config/`;
  const js = buildWidgetJs(chatUrl, configUrl);
  return new Response(js, {
    status: 200,
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
