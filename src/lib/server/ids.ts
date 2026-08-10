import "server-only";
import crypto from "crypto";

/** 6-char uppercase code, mirrors uuid4().hex[:6].upper(). */
export function sixCharCode(): string {
  return crypto.randomBytes(3).toString("hex").slice(0, 6).toUpperCase();
}

/** Mirrors f"bot_{secrets.token_urlsafe(24)}". */
export function widgetKey(): string {
  return `bot_${crypto.randomBytes(24).toString("base64url")}`;
}

/** Mirrors f"pi_{secrets.token_hex(12)}". */
export function fakeProviderIntentId(): string {
  return `pi_${crypto.randomBytes(12).toString("hex")}`;
}

/** Mirrors uuid.uuid4().hex (32 hex chars, no dashes). */
export function uuidHex(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function isoNowPlusMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function isoNowPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}
