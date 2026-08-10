import { handleGetStats } from "@/lib/server/handlers/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleGetStats;
