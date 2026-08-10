/** If the model repeats citation (one-line + expanded), drop the one-line compact line first. */
function stripRedundantCompactSourceLine(text: string): string {
  const sourceHits = text.match(/\bSource\s*:/gi);
  if (!sourceHits || sourceHits.length < 2) return text;
  return text
    .split("\n")
    .filter((line) => {
      const compact = /source\s*:/i.test(line) && /page\s*number\s*:/i.test(line);
      return !compact;
    })
    .join("\n");
}

/** Keep a single formatted Source / Page number block when normalization produced duplicates. */
function dedupeFormattedSourcePageBlocks(text: string): string {
  const re =
    /(?:^|\n)(\s*\*\*Source:\*\*\s*\n[^\n]+\s*\n+\*\*Page number:\*\*\s*\n[^\n]+)/gi;
  const matches = [...text.matchAll(re)];
  if (matches.length <= 1) return text;
  let out = text;
  for (let i = 0; i < matches.length - 1; i++) {
    const full = matches[i][0];
    const pos = out.indexOf(full);
    if (pos !== -1) {
      out = `${out.slice(0, pos)}\n${out.slice(pos + full.length)}`;
    }
  }
  return out;
}

/**
 * Remove plain-text "Source: … Page number: …" when structured **Source:** / **Page number:** exists.
 */
function stripPlainCompactCitationWhenMarkdownBlocksPresent(text: string): string {
  if (!/\*\*Source:\*\*/i.test(text) || !/\*\*Page number:\*\*/i.test(text)) {
    return text;
  }
  return text
    .replace(/\bSource\s*:?\s*.+?\s+Page\s*number\s*:?\s*.+?(?=\n|$)/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convert the assistant body (before Source/Page metadata) into a single paragraph.
 * Keeps Source/Page markdown blocks separate and intact.
 */
function collapseBodyToSingleParagraph(text: string): string {
  const sourceIdx = text.search(/\n?\s*\*\*Source:\*\*/i);
  const body = sourceIdx === -1 ? text : text.slice(0, sourceIdx);
  const citation = sourceIdx === -1 ? "" : text.slice(sourceIdx);

  const normalizedBody = body
    // Flatten any HTML list wrappers some models return.
    .replace(/<\/?(?:ul|ol)\b[^>]*>/gi, " ")
    .replace(/<li\b[^>]*>/gi, " ")
    .replace(/<\/li>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    // Remove common literal bullet glyphs.
    .replace(/[•●◦▪◉]/g, " ")
    // Remove leading dot markers users often see from model list formatting.
    .replace(/(^|\n)\s*\.\s*/g, "$1")
    // Remove markdown list markers like "-", "*", "+", "1." at line starts.
    .replace(/(^|\n)\s*(?:[-*+]|\d+\.)\s+/g, "$1")
    // Normalize any remaining line breaks to spaces for one flowing paragraph.
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!citation.trim()) return normalizedBody;
  if (!normalizedBody) return citation.trim();
  return `${normalizedBody}\n\n${citation.trim()}`;
}

/**
 * Normalize RAG/PDF-style assistant text into markdown (paragraphs, bold Source/Page labels)
 * so it renders like a markdown preview in ReactMarkdown or markdown-it (floating widget).
 */
export function normalizeAssistantMarkdown(raw: string): string {
  let t = raw.trim();
  t = stripRedundantCompactSourceLine(t);

  // Convert bullet glyph separators to paragraph breaks (not markdown list items).
  t = t.replace(/\s+•\s+/g, "\n\n");
  t = t.replace(/^\s*•\s+/gm, "");

  t = t.replace(
    /\bSource\s*:?\s*(.+?)\s+Page\s*number\s*:?\s*([^\n]+)/gi,
    (_m, sourceVal: string, pageVal: string) =>
      `\n\n**Source:**\n${sourceVal.trim()}\n\n**Page number:**\n${pageVal.trim()}`
  );

  t = t.replace(
    /(?:^|\n)\s*Source\s*:?\s*([^\n]+?)(?=\n|$)/gi,
    (_m, value: string) => `\n**Source:**\n${value.trim()}`
  );
  t = t.replace(
    /(?:^|\n)\s*Page\s*number\s*:?\s*([^\n]+?)(?=\n|$)/gi,
    (_m, value: string) => `\n**Page number:**\n${value.trim()}`
  );

  t = dedupeFormattedSourcePageBlocks(t);
  t = stripPlainCompactCitationWhenMarkdownBlocksPresent(t);
  t = collapseBodyToSingleParagraph(t);
  return t.replace(/\n{3,}/g, "\n\n").trim();
}
