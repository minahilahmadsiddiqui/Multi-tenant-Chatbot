import { handleBotWorkspace } from "@/lib/server/handlers/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { bot_id: string } }) {
  return handleBotWorkspace(request, params.bot_id);
}
