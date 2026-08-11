import "server-only";
import fs from "fs";
import path from "path";
import * as admin from "firebase-admin";
import { env } from "./env";

function decodeServiceAccountJson(raw: string): admin.ServiceAccount {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Firebase service account value is empty");
  }

  let text = trimmed;
  if (!trimmed.startsWith("{")) {
    try {
      text = Buffer.from(trimmed, "base64").toString("utf-8").trim();
    } catch {
      throw new Error("Firebase service account value is not valid JSON or base64");
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Firebase service account JSON could not be parsed");
  }

  const record = parsed as { client_email?: unknown; private_key?: unknown };
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof record.client_email !== "string" ||
    typeof record.private_key !== "string"
  ) {
    throw new Error("Firebase service account JSON is missing required fields");
  }

  return parsed as admin.ServiceAccount;
}

function loadServiceAccount(): admin.ServiceAccount {
  const inline = (env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (inline) {
    return decodeServiceAccountJson(inline);
  }

  const configured = (env.FIREBASE_CREDENTIALS_PATH || "").trim();
  if (!configured) {
    throw new Error(
      "Firebase credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CREDENTIALS_PATH."
    );
  }

  const credPath = path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
  const raw = fs.readFileSync(credPath, "utf-8");
  return decodeServiceAccountJson(raw);
}

let app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (app) return app;
  if (admin.apps.length > 0) {
    app = admin.apps[0]!;
    return app;
  }
  const serviceAccount = loadServiceAccount();
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return app;
}

let firestoreClient: admin.firestore.Firestore | null = null;

export function getFirestore(): admin.firestore.Firestore {
  if (firestoreClient) return firestoreClient;
  firestoreClient = getApp().firestore();
  return firestoreClient;
}

export { admin };
