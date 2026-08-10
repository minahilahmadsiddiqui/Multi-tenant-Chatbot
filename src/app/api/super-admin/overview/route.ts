import { handleSuperAdminOverview } from "@/lib/server/handlers/superAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleSuperAdminOverview;
