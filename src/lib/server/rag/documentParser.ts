import "server-only";

/** Mirrors document_parser.extract_text_from_upload for .txt/.pdf/.docx. */
export async function extractTextFromUpload(
  filename: string,
  raw: Buffer
): Promise<string | null> {
  if (!raw || raw.length === 0) return null;
  const lower = String(filename || "").toLowerCase();
  const ext = lower.slice(lower.lastIndexOf(".")).trim().toLowerCase();

  if (ext === ".txt") {
    try {
      return raw.toString("utf-8");
    } catch {
      return raw.toString("latin1");
    }
  }

  if (ext === ".pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(raw);
      const out = String(data.text || "").trim();
      return out || null;
    } catch {
      return null;
    }
  }

  if (ext === ".docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: raw });
      const out = String(result.value || "").trim();
      return out || null;
    } catch {
      return null;
    }
  }

  return null;
}
