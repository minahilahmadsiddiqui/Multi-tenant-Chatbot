import { handleBotsList, handleBotsCreate } from "@/lib/server/handlers/bots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleBotsList;
export const POST = handleBotsCreate;
