import { handleAddCompany } from "@/lib/server/handlers/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleAddCompany;
