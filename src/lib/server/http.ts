import "server-only";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown>;
  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.error === "string" ? payload.error : `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data as object, { status, headers });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(err.payload, { status: err.status });
  }
  const mapped = mapExternalApiError(err);
  if (mapped) {
    return NextResponse.json(mapped.payload, { status: mapped.status });
  }
  console.error("Unhandled API error:", err);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

export function mapExternalApiError(err: unknown, context?: string): ApiError | null {
  const status = Number((err as { status?: number })?.status);
  if (!Number.isFinite(status) || status < 400) return null;

  const nested = (err as { error?: { message?: string; code?: string } })?.error;
  const message = String(nested?.message || (err as Error)?.message || "External API request failed.").trim();
  const code = String(nested?.code || (err as { code?: string })?.code || "").trim();
  const combined = `${message} ${code}`.toLowerCase();

  let hint = "";
  if (status === 401) {
    if (combined.includes("invalid_issuer") || combined.includes("valid issuer")) {
      hint =
        "This API key does not match the selected provider. OpenRouter keys (sk-or-...) only work with the OpenRouter provider.";
    } else {
      hint = "Verify the API key is correct, active, and belongs to the selected provider.";
    }
  }

  const prefix = context ? `${context}: ` : "";
  return new ApiError(status >= 500 ? 502 : status, {
    error: `${prefix}${message}`,
    ...(hint ? { hint } : {}),
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

export function parseIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function isTruthyFlag(v: unknown): boolean {
  return ["1", "true", "yes", "y", "on"].includes(String(v ?? "").trim().toLowerCase());
}
