import { handlePublicChatQuery } from "@/lib/server/handlers/chat";
import { publicCorsPreflight, withPublicCors } from "@/lib/server/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withPublicCors(await handlePublicChatQuery(request));
}

export function OPTIONS() {
  return publicCorsPreflight();
}
