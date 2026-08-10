import "server-only";
import fs from "fs";
import path from "path";
import * as admin from "firebase-admin";
import { env } from "./env";

function resolveCredentialsPath(): string {
  const configured = (env.FIREBASE_CREDENTIALS_PATH || "").trim();
  if (configured) return configured;
  // Default: the service account JSON that ships in the repo root (one level above web/).
  return path.join(process.cwd(), "..", "acme-one-chatbot-firebase-adminsdk-fbsvc-def9733648.json");
}

let app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (app) return app;
  if (admin.apps.length > 0) {
    app = admin.apps[0]!;
    return app;
  }
  const credPath = resolveCredentialsPath();
  const raw = fs.readFileSync(credPath, "utf-8");
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
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
