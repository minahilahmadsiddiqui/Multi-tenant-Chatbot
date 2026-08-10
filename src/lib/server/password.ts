import "server-only";
import crypto from "crypto";

/**
 * Django-compatible PBKDF2 password hashing so existing admin hashes in Firestore
 * keep working. Format: pbkdf2_sha256$<iterations>$<salt>$<base64 hash>
 */

const ALGORITHM = "pbkdf2_sha256";
const DEFAULT_ITERATIONS = 600000;
const DIGEST = "sha256";
const KEY_LEN = 32;

function pbkdf2(password: string, salt: string, iterations: number): string {
  const derived = crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, DIGEST);
  return derived.toString("base64");
}

function randomSalt(length = 22): string {
  // Django uses an alphanumeric salt; base64url without padding gives similar entropy.
  return crypto.randomBytes(16).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, length);
}

export function makePassword(password: string, iterations = DEFAULT_ITERATIONS): string {
  const salt = randomSalt();
  const hash = pbkdf2(password, salt, iterations);
  return `${ALGORITHM}$${iterations}$${salt}$${hash}`;
}

export function checkPassword(password: string, encoded: string): boolean {
  try {
    const parts = String(encoded || "").split("$");
    if (parts.length !== 4) return false;
    const [algorithm, iterationsRaw, salt, hash] = parts;
    if (algorithm !== ALGORITHM) return false;
    const iterations = parseInt(iterationsRaw, 10);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    const computed = pbkdf2(password, salt, iterations);
    const a = Buffer.from(computed);
    const b = Buffer.from(hash);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
