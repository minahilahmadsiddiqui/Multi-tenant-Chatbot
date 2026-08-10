import { handleBotDetailGet, handleBotDetailPatch } from "@/lib/server/handlers/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { bot_id: string } }) {
  return handleBotDetailGet(request, params.bot_id);
}

export async function PATCH(request: Request, { params }: { params: { bot_id: string } }) {
  return handleBotDetailPatch(request, params.bot_id);
}
