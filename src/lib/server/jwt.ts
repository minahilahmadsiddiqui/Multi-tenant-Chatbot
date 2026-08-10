import "server-only";
import jwt from "jsonwebtoken";
import { env } from "./env";
import type { AdminRecord } from "./repository";

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  company_id: number | null;
  type: "access" | "refresh";
  jti?: string;
  iat?: number;
  exp?: number;
}

const alg = env.JWT_ALGORITHM as jwt.Algorithm;

export function generateAccessToken(admin: AdminRecord): string {
  const payload = {
    sub: String(admin.id),
    email: admin.email,
    role: admin.role,
    company_id: admin.company_id ?? null,
    type: "access" as const,
  };
  return jwt.sign(payload, env.JWT_SECRET_KEY, {
    algorithm: alg,
    expiresIn: `${env.JWT_ACCESS_TOKEN_LIFETIME_MIN}m`,
  });
}

export function generateRefreshToken(admin: AdminRecord, jti: string): string {
  const payload = {
    sub: String(admin.id),
    email: admin.email,
    role: admin.role,
    company_id: admin.company_id ?? null,
    type: "refresh" as const,
    jti,
  };
  return jwt.sign(payload, env.JWT_SECRET_KEY, {
    algorithm: alg,
    expiresIn: `${env.JWT_REFRESH_TOKEN_LIFETIME_DAYS}d`,
  });
}

export type DecodedResult =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; reason: "expired" | "invalid" };

export function verifyToken(token: string): DecodedResult {
  try {
    const claims = jwt.verify(token, env.JWT_SECRET_KEY, { algorithms: [alg] }) as AccessTokenClaims;
    return { ok: true, claims };
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}
