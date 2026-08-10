import { handleUploadDocument } from "@/lib/server/handlers/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handleUploadDocument;
