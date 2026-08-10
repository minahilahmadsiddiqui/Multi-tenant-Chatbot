import { handleGetAdminCompany } from "@/lib/server/handlers/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleGetAdminCompany;
