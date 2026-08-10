import "server-only";
import { getEncoding, encodingForModel, type Tiktoken } from "js-tiktoken";

export type ChunkTuple = [text: string, tokenCount: number, sourceSection: string, pageNumber: number | null, chapterName: string];

let _enc: Tiktoken | null = null;
function enc(): Tiktoken {
  if (_enc) return _enc;
  try {
    _enc = encodingForModel("text-embedding-3-small");
  } catch {
    _enc = getEncoding("cl100k_base");
  }
  return _enc;
}

const CHAPTER_HEADING_RE =
  /^\s*(?:chapter|ch\.)\s+(?:(\d{1,3})\b|([ivxlcdm]{1,12})\b|(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)\s*[.:\-\u2013\u2014]?\s*(.*)$/i;
const CHAPTER_UNNUMBERED_RE = /^\s*chapter\s*[:\-\u2013\u2014]\s*(.{3,120})\s*$/i;
const SECTION_LINE_RE = /^\s*(?:SOURCE[_\s]*SECTION|SECTION)\s*[:=\-]\s*(.+?)\s*$/i;
const PAGE_EMBEDDED_RE = /^.{0,120}?Page\s+(\d{1,5})\s*(?:={2,}\s*)(.+)$/i;
const IMPLICIT_SECTION_HEADING_RE = /^\s*(\d+\.\d+(?:\.\d+)?)\s+([A-Z][^\n]{0,120})\s*$/;

export function parseStandalonePageLine(ln: string): number | null {
  const s = (ln || "").trim();
  const patterns = [
    /^=+\s*page\s+(\d{1,5})\s*=+\s*$/i,
    /^page[\s_]*number\s*[:=\-]+\s*(\d{1,5})\s*$/i,
    /^page\s*[:=\-]+\s*(\d{1,5})\s*$/i,
    /^page\s+(\d{1,5})\s*$/i,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) {
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export function lineLooksLikeTocLeader(ln: string): boolean {
  if (!ln) return false;
  if (/\.{4,}/.test(ln)) return true;
  if ((ln.match(/\./g) || []).length >= 8 && /\.{2,}/.test(ln)) return true;
  return false;
}

export function textContainsTocDotRun(text: string): boolean {
  return Boolean(text && /\.{4,}/.test(text));
}

export function normalizeHandbookText(text: string): string {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").map((ln) => ln.replace(/\s+$/, ""));
  const out: string[] = [];
  let blankRun = 0;
  for (const ln of lines) {
    if (!ln.trim()) {
      blankRun += 1;
      if (blankRun <= 2) out.push("");
      continue;
    }
    blankRun = 0;
    out.push(ln.trim());
  }
  return out.join("\n").trim();
}

export function handbookHasSectionMarkers(text: string): boolean {
  return text.split("\n").some((ln) => SECTION_LINE_RE.test(ln.trim()));
}

export function handbookHasChapterMarkers(text: string): boolean {
  for (const raw of text.split("\n")) {
    const ln = raw.trim();
    if (!ln || ln.length > 200) continue;
    if (CHAPTER_HEADING_RE.test(ln) || CHAPTER_UNNUMBERED_RE.test(ln)) return true;
  }
  return false;
}

export function handbookHasAutoStructure(text: string): boolean {
  if (handbookHasChapterMarkers(text)) return true;
  for (const raw of text.split("\n")) {
    const ln = raw.trim();
    if (!ln) continue;
    if (parseStandalonePageLine(ln) !== null || PAGE_EMBEDDED_RE.test(ln)) return true;
    if (IMPLICIT_SECTION_HEADING_RE.test(ln)) return true;
  }
  return false;
}

function titleCase(s: string): string {
  return s.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function chapterLabelFromLine(ln: string): string {
  const m = ln.trim().match(CHAPTER_HEADING_RE);
  if (m) {
    const arabic = (m[1] || "").trim();
    const roman = (m[2] || "").trim();
    const word = (m[3] || "").trim();
    const tail = (m[4] || "").trim();
    let core: string;
    if (arabic) core = `Chapter ${arabic}`;
    else if (roman) core = `Chapter ${roman.toUpperCase()}`;
    else if (word) core = `Chapter ${titleCase(word)}`;
    else core = "Chapter";
    return tail ? `${core}: ${tail}`.trim() : core;
  }
  const m2 = ln.trim().match(CHAPTER_UNNUMBERED_RE);
  if (m2) {
    const t = (m2[1] || "").trim();
    return t ? `Chapter: ${t}` : "";
  }
  return "";
}

export function inferPageFromChunkText(text: string): number | null {
  if (!text) return null;
  let m = text.match(/={2,}\s*page\s+(\d{1,5})\b/i);
  if (m) return parseInt(m[1], 10);
  m = text.match(/\bpage\s*[:#]?\s*(\d{1,5})\b/i);
  if (m) return parseInt(m[1], 10);
  m = text.match(/\bp\s+age\s+(\d{1,5})\b/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function inferSectionFromChunkText(text: string): string | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const hasToc = textContainsTocDotRun(text);
  const pageRe = /\bpage\s*[:#]?\s*(\d{1,5})\b/i;
  let pageIdx: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (pageRe.test(lines[i]) || /={2,}\s*page\s+\d{1,5}\b/i.test(lines[i])) {
      pageIdx = i;
      break;
    }
  }
  if (pageIdx !== null && pageIdx > 0) {
    let candidate = lines[pageIdx - 1];
    if (lineLooksLikeTocLeader(candidate)) candidate = "";
    if (
      candidate &&
      candidate.length >= 3 &&
      candidate.length <= 120 &&
      !candidate.toLowerCase().startsWith("page") &&
      !candidate.endsWith(".")
    ) {
      return candidate;
    }
  }

  if (!hasToc) {
    const m = text.match(/\b(\d+(?:\.\d+)+)\s+([A-Za-z][^\n]{0,80})/i);
    if (m) {
      const num = m[1].trim();
      let titleTail = m[2].trim();
      titleTail = titleTail.replace(/[,:;.].*$/, "").trim();
      if (titleTail) return `${num} ${titleTail}`.trim();
    }
  }

  const m = text.match(/\b(?:section|policy|chapter)\s*[:\-]\s*([^\n]{3,120})/i);
  if (m) {
    let candidate = m[1].trim();
    candidate = candidate.replace(/\.{3,}.*$/, "").trim();
    if (candidate && candidate.length >= 3 && candidate.length <= 120 && !lineLooksLikeTocLeader(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function inferChapterFromChunkText(text: string): string {
  for (const ln of (text || "").split(/\r?\n/)) {
    const lab = chapterLabelFromLine(ln.trim());
    if (lab) return lab;
  }
  return "";
}

export function inferLegacyChunkMetadata(text: string): [string, number | null, string] {
  const sec = inferSectionFromChunkText(text);
  return [sec || "", inferPageFromChunkText(text), inferChapterFromChunkText(text)];
}

function titleBeforeNumberedClause(rest: string): string {
  if (!rest || rest.length < 5) return "";
  const m = rest.trim().match(/^(.{3,90}?)\s+(\d+\.\d+(?:\.\d+)?)\s+[A-Za-z]/);
  if (!m) return "";
  const cand = (m[1] || "").trim();
  return cand.length >= 3 ? cand : "";
}

export function splitAutoStructuredIntoEmbeddingChunks(
  text: string,
  chunkSizeTokens: number,
  overlapTokens: number
): ChunkTuple[] {
  const results: ChunkTuple[] = [];
  let currentSection = "";
  let currentChapter = "";
  let currentPage: number | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (!currentSection) return;
    const local = [...bodyLines];
    while (local.length && !local[0].trim()) local.shift();
    while (local.length && !local[local.length - 1].trim()) local.pop();
    const body = local.join("\n").trim();
    if (!body) return;
    const [subChunks, subCounts] = splitTextIntoTokenChunks(body, chunkSizeTokens, overlapTokens);
    const chOut = currentChapter || "";
    for (let i = 0; i < subChunks.length; i++) {
      results.push([subChunks[i], subCounts[i], currentSection, currentPage, chOut]);
    }
  };

  for (const rawLn of text.split("\n")) {
    const ln = rawLn.trim();
    const secM = ln.match(SECTION_LINE_RE);
    if (secM) {
      flush();
      currentSection = (secM[1] || "").trim();
      currentPage = null;
      bodyLines = [];
      continue;
    }
    if (lineLooksLikeTocLeader(ln)) continue;

    const chLabel = chapterLabelFromLine(ln);
    if (chLabel) {
      flush();
      currentChapter = chLabel;
      currentSection = chLabel;
      bodyLines = [];
      continue;
    }

    const imp = ln.match(IMPLICIT_SECTION_HEADING_RE);
    if (imp) {
      flush();
      const num = (imp[1] || "").trim();
      const tail = (imp[2] || "").trim();
      const parts = tail.match(/^(\S+)\s+([\s\S]*)$/);
      if (parts) {
        currentSection = `${num} ${parts[1]}`.trim();
        bodyLines = parts[2] ? [parts[2]] : [];
      } else {
        currentSection = ln.trim();
        bodyLines = [];
      }
      continue;
    }

    if (!currentSection) {
      const pv = parseStandalonePageLine(ln);
      if (pv !== null) {
        currentPage = pv;
        currentSection = "Handbook";
        currentChapter = "";
        continue;
      }
      const emb = ln.match(PAGE_EMBEDDED_RE);
      if (emb) {
        const n = parseInt(emb[1], 10);
        currentPage = Number.isFinite(n) ? n : null;
        const restv = (emb[2] || "").trim();
        const titleGuess = titleBeforeNumberedClause(restv);
        currentSection = titleGuess || "Handbook";
        currentChapter = "";
        if (restv) bodyLines.push(restv);
        continue;
      }
      continue;
    }

    const pv = parseStandalonePageLine(ln);
    if (pv !== null) {
      currentPage = pv;
      continue;
    }
    const emb = ln.match(PAGE_EMBEDDED_RE);
    if (emb) {
      const n = parseInt(emb[1], 10);
      currentPage = Number.isFinite(n) ? n : null;
      const restv = (emb[2] || "").trim();
      if (restv) bodyLines.push(restv);
      continue;
    }
    bodyLines.push(rawLn.replace(/\s+$/, ""));
  }
  flush();
  return results;
}

export function splitHandbookIntoEmbeddingChunks(
  text: string,
  chunkSizeTokens: number,
  overlapTokens: number
): ChunkTuple[] {
  if (!handbookHasSectionMarkers(text)) return [];
  const results: ChunkTuple[] = [];
  let currentSection = "";
  let currentPage: number | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (!currentSection) return;
    const local = [...bodyLines];
    while (local.length && !local[0].trim()) local.shift();
    while (local.length && !local[local.length - 1].trim()) local.pop();
    const body = local.join("\n").trim();
    if (!body) return;
    const [subChunks, subCounts] = splitTextIntoTokenChunks(body, chunkSizeTokens, overlapTokens);
    const chOut = chapterLabelFromLine(currentSection) || "";
    for (let i = 0; i < subChunks.length; i++) {
      results.push([subChunks[i], subCounts[i], currentSection, currentPage, chOut]);
    }
  };

  for (const rawLn of text.split("\n")) {
    const ln = rawLn.trim();
    const secM = ln.match(SECTION_LINE_RE);
    if (secM) {
      flush();
      currentSection = (secM[1] || "").trim();
      currentPage = null;
      bodyLines = [];
      continue;
    }
    if (!currentSection) continue;
    if (lineLooksLikeTocLeader(ln)) continue;
    const pv = parseStandalonePageLine(ln);
    if (pv !== null) {
      currentPage = pv;
      continue;
    }
    const emb = ln.match(PAGE_EMBEDDED_RE);
    if (emb) {
      const n = parseInt(emb[1], 10);
      currentPage = Number.isFinite(n) ? n : null;
      const restv = (emb[2] || "").trim();
      if (restv) bodyLines.push(restv);
      continue;
    }
    bodyLines.push(rawLn.replace(/\s+$/, ""));
  }
  flush();
  return results;
}

export function normalizeText(text: string): string {
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.split(/\s+/).filter(Boolean).join(" ");
  return text.trim();
}

export function countTokens(text: string): number {
  return enc().encode(text || "").length;
}

export function truncateTextToTokenBudget(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return "";
  const ids = enc().encode(text || "");
  if (ids.length <= maxTokens) return text || "";
  return enc().decode(ids.slice(0, maxTokens));
}

export function splitTextIntoTokenChunks(
  text: string,
  chunkSizeTokens = 500,
  overlapTokens = 75
): [string[], number[]] {
  if (chunkSizeTokens <= 0) throw new Error("chunk_size_tokens must be > 0");
  if (overlapTokens < 0) throw new Error("overlap_tokens must be >= 0");
  if (overlapTokens >= chunkSizeTokens) throw new Error("overlap_tokens must be < chunk_size_tokens");

  const tokenIds = enc().encode(text);
  if (!tokenIds.length) return [[], []];

  const chunks: string[] = [];
  const counts: number[] = [];
  let start = 0;
  while (start < tokenIds.length) {
    const end = Math.min(start + chunkSizeTokens, tokenIds.length);
    const chunkIds = tokenIds.slice(start, end);
    chunks.push(enc().decode(chunkIds));
    counts.push(chunkIds.length);
    if (end === tokenIds.length) break;
    start = end - overlapTokens;
  }
  return [chunks, counts];
}
