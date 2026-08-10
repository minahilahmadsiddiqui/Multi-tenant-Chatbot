import "server-only";
import { NextResponse } from "next/server";

/** Public widget endpoints are embedded on arbitrary customer sites. */
const PUBLIC_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function publicCorsHeaders(): Record<string, string> {
  return { ...PUBLIC_CORS_HEADERS };
}

export function withPublicCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(PUBLIC_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function publicCorsPreflight(): Response {
  return new NextResponse(null, {
    status: 204,
    headers: PUBLIC_CORS_HEADERS,
  });
}
