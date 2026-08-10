import { handleSuperAdminUpdateCompanyPlan } from "@/lib/server/handlers/superAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { company_id: string } }) {
  return handleSuperAdminUpdateCompanyPlan(request, params.company_id);
}
