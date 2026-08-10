import { handlePublicWidgetScript } from "@/lib/server/handlers/public";
import { publicCorsPreflight, withPublicCors } from "@/lib/server/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return withPublicCors(handlePublicWidgetScript(request));
}

export function OPTIONS() {
  return publicCorsPreflight();
}
