import { handleDeleteDocument } from "@/lib/server/handlers/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: { doc_id: string } }) {
  return handleDeleteDocument(request, params.doc_id);
}
