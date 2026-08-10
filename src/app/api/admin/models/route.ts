import { handleListProviderModels } from "@/lib/server/handlers/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleListProviderModels(request);
}
