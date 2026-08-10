import { handleAdminChatQuery } from "@/lib/server/handlers/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleAdminChatQuery;
