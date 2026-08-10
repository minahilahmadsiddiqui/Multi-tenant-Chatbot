import { handleSuperAdminCompanies } from "@/lib/server/handlers/superAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleSuperAdminCompanies;
