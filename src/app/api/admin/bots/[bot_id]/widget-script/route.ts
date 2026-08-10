import { handleGenerateWidgetScript } from "@/lib/server/handlers/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { bot_id: string } }) {
  return handleGenerateWidgetScript(request, params.bot_id);
}
