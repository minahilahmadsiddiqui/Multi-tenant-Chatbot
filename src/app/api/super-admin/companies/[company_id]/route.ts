import { handleSuperAdminCompanyDetail } from "@/lib/server/handlers/superAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { company_id: string } }) {
  return handleSuperAdminCompanyDetail(request, params.company_id);
}
