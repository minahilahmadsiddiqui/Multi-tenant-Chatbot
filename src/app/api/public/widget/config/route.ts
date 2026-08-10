import { handlePublicWidgetConfig } from "@/lib/server/handlers/public";
import { publicCorsPreflight, withPublicCors } from "@/lib/server/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withPublicCors(await handlePublicWidgetConfig(request));
}

export function OPTIONS() {
  return publicCorsPreflight();
}
