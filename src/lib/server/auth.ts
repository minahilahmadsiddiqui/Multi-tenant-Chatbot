import "server-only";
import { verifyToken } from "./jwt";
import { getRepo, type AdminRecord } from "./repository";
import { ApiError, parseIntOrNull } from "./http";
import { cacheGet, cacheSet } from "./cache";

const ADMIN_CACHE_TTL_SEC = 60;

async function getAdminCached(adminId: number): Promise<AdminRecord | null> {
  const key = `admin:${adminId}`;
  const cached = cacheGet<AdminRecord>(key);
  if (cached) return cached;
  const admin = await getRepo().getAdmin(adminId);
  if (admin) cacheSet(key, admin, ADMIN_CACHE_TTL_SEC);
  return admin;
}

export interface AdminUser {
  id: number;
  email: string;
  role: string;
  company_id: number | null;
  record: AdminRecord;
}

/**
 * Mirrors DRF JWTAuthentication:
 * - No/blank Authorization header => returns null (anonymous)
 * - Malformed/expired/invalid token => throws ApiError(401)
 * - Valid token but admin missing/unverified => throws ApiError(401)
 */
export async function authenticate(request: Request): Promise<AdminUser | null> {
  const header = request.headers.get("authorization") || "";
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  const token = parts[1];

  const decoded = verifyToken(token);
  if (!decoded.ok) {
    throw new ApiError(401, {
      detail: decoded.reason === "expired" ? "Access token expired." : "Invalid access token.",
    });
  }
  if (decoded.claims.type !== "access") {
    throw new ApiError(401, { detail: "Invalid token type." });
  }
  const adminId = parseIntOrNull(decoded.claims.sub);
  if (adminId === null) {
    throw new ApiError(401, { detail: "Invalid admin id in token." });
  }
  const admin = await getAdminCached(adminId);
  if (!admin) {
    throw new ApiError(401, { detail: "Admin not found." });
  }
  if (!admin.is_verified) {
    throw new ApiError(401, { detail: "Admin email not verified." });
  }
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    company_id: admin.company_id,
    record: admin,
  };
}

export function requireAdmin(user: AdminUser | null): AdminUser {
  if (!user || !["admin", "super_admin"].includes(user.role)) {
    throw new ApiError(403, { detail: "You do not have permission to perform this action." });
  }
  return user;
}

export function requireSuperAdmin(user: AdminUser | null): AdminUser {
  if (!user || user.role !== "super_admin") {
    throw new ApiError(403, { detail: "You do not have permission to perform this action." });
  }
  return user;
}
