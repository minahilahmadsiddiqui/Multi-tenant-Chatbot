import "server-only";
import { getRepo } from "../repository";
import { authenticate, requireAdmin } from "../auth";
import { resolveCompanyScope } from "../tenant";
import { json, readJson, errorResponse } from "../http";

export async function handleAddCompany(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const repo = getRepo();
    const admin = await repo.getAdmin(user.id);
    if (admin && admin.company_id != null) {
      return json({ error: "Admin already has a company." }, 409);
    }
    const body = await readJson(request);
    const name = String(body.name ?? "").trim();
    const planType = (String(body.plan_type ?? "free").trim().toLowerCase() || "free");
    if (!["free", "paid"].includes(planType)) {
      return json({ error: "plan_type must be either 'free' or 'paid'." }, 400);
    }
    if (!name) return json({ error: "name is required." }, 400);
    if (await repo.findCompanyByName(name)) {
      return json({ error: "Company name already exists." }, 409);
    }
    const company = await repo.createCompany({ name, admin_id: user.id, plan_type: planType });
    await repo.updateAdmin(user.id, { company_id: company.id });
    return json(
      {
        message: "Company created.",
        company: { id: company.id, name: company.name, admin_id: company.admin_id },
      },
      201
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function handleGetAdminCompany(request: Request) {
  try {
    const user = requireAdmin(await authenticate(request));
    const url = new URL(request.url);
    const companyId = await resolveCompanyScope(user, { searchParams: url.searchParams });
    const company = await getRepo().getCompany(companyId);
    if (!company) return json({ error: "Company not found." }, 404);
    return json({ company: { id: company.id, name: company.name, admin_id: company.admin_id } });
  } catch (e) {
    return errorResponse(e);
  }
}
