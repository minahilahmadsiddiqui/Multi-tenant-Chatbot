import "server-only";

/** Keep in sync with generate.ts UNKNOWN_POLICY_PHRASE. */
export const UNKNOWN_POLICY_PHRASE = "The document doesn't mention it.";
export const CLOSING_LINE = "If you have any further questions, do let me know.";

export interface Citation {
  doc_id?: unknown;
  chunk_index?: unknown;
  chunk_id?: unknown;
  text_preview?: unknown;
  token_count?: unknown;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function rstripColon(s: string): string {
  return s.replace(/:+$/, "");
}

function isUpper(s: string): boolean {
  return /[A-Za-z]/.test(s) && s === s.toUpperCase() && s !== s.toLowerCase();
}

// --- Artifact-stripping regexes (translated from response_beautify_service.py) ---
const LA = "(?=\\s+(?:[A-Za-z]{2,})\\b|\\s+\\u2022|$)";
const HAND_BOOK_PAGE_PIPE = new RegExp(
  "\\d{1,3}\\s*\\|\\s*[Pp]\\s+[Aa][Gg][Ee]\\s*\\d{1,3}\\s+(?:[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\\s+\\d{1,2}\\s*:\\s*)?(?:[A-Z]{2,}(?:\\s+[A-Z]{2,})*)?" +
    LA,
  "g"
);
const HAND_BOOK_PAGE_PIPE_NORMAL = new RegExp(
  "\\d{1,3}\\s*\\|\\s*[Pp][Aa][Gg][Ee]\\s+\\d{1,3}\\s+(?:[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\\s+\\d{1,2}\\s*:\\s*)?(?:[A-Z]{2,}(?:\\s+[A-Z]{2,})*)?" +
    LA,
  "g"
);
const HAND_BOOK_PAGE_EQUALS = /\s*=+\s*[Pp][Aa][Gg][Ee]\s+\d{1,5}\s*=+\s*/g;
const HAND_BOOK_CHAPTER_INLINE = new RegExp(
  "(?<=[.!?\\u2022\\n])\\s+[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\\s+\\d{1,2}\\s*:\\s*(?:[A-Z]{2,}(?:\\s+[A-Z]{2,})*)" +
    LA,
  "g"
);
const AMP_LA = "(?=\\s+(?:[A-Za-z]{2,})\\b|\\s+\\u2022|$|\\.\\s+(?:[A-Za-z]{2,})\\b|[,;](?:\\s|$))";
const AMP_SECTION_HEADING = new RegExp(
  "(?:^|(?<=[.!?\\u2022\\n]))[ \\t]*&[ \\t]+(?:[A-Z][a-z]+|[A-Z]{2,}\\b)(?:[ \\t]+(?:[A-Z][a-z]+|[A-Z]{2,}\\b))*" +
    AMP_LA,
  "gm"
);
const AMP_HEADING_LINE =
  /^\s*&\s+(?:[A-Z][a-z]+|[A-Z]{2,}\b)(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,}\b))*\s*$/gim;

export function stripHandbookLayoutArtifacts(text: string): string {
  let t = (text || "").trim();
  if (!t) return t;
  t = t.replace(HAND_BOOK_PAGE_EQUALS, " ");
  let prev: string | null = null;
  while (prev !== t) {
    prev = t;
    t = t.replace(HAND_BOOK_PAGE_PIPE, " ");
    t = t.replace(HAND_BOOK_PAGE_PIPE_NORMAL, " ");
    t = t.replace(HAND_BOOK_CHAPTER_INLINE, " ");
    t = t.replace(AMP_SECTION_HEADING, " ");
    t = t.replace(AMP_HEADING_LINE, "");
  }
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/ *\n */g, "\n");
  return t.trim();
}

function stripInlineMarkdownNoise(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\*/g, "");
}

function headingDisplayText(line: string): string {
  const s = line.trim();
  const m = s.match(/^#{1,6}\s+(.*)$/);
  if (m) return rstripColon(m[1].trim()).trim();
  return rstripColon(s).trim();
}

function isHeadingLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (/^#{1,6}\s+\S/.test(s)) return true;
  const low = s.toLowerCase();
  if (low === "sources:" || low.startsWith("sources:")) return false;
  if (/^\d+[.)]\s/.test(s)) return false;
  if (s.length > 120) return false;
  if (s.endsWith(":")) return true;
  if (s.length <= 42 && isUpper(s)) return true;
  return false;
}

function formatSourcesBlock(block: string): string {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return "";
  const first = lines[0];
  let rest = lines.length > 1 ? lines.slice(1) : [];
  if (!first.toLowerCase().startsWith("sources")) rest = lines;
  const bullets: string[] = [];
  for (const ln of rest) {
    if (/^\d+[.)]\s/.test(ln)) {
      const body = ln.replace(/^\d+[.)]\s+/, "").trim();
      if (body) bullets.push(`- ${body}`);
    } else if (/^[-*]\s+/.test(ln)) {
      bullets.push(`- ${ln.replace(/^[-*]\s+/, "").trim()}`);
    } else {
      bullets.push(`- ${ln}`);
    }
  }
  if (!bullets.length) return "### Sources\n";
  return "### Sources\n\n" + bullets.join("\n");
}

function formatMainBody(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const p = para.map((x) => x.trim()).filter(Boolean).join(" ");
    if (p) {
      out.push(p);
      out.push("");
    }
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      continue;
    }
    if (isHeadingLine(line)) {
      flushPara();
      out.push(`## ${headingDisplayText(line)}`);
      out.push("");
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      flushPara();
      const m = line.match(/^(\d+)[.)]\s+(.*)$/);
      if (m) {
        out.push(`${m[1]}. ${m[2].trim()}`);
        out.push("");
      }
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      out.push(`- ${line.replace(/^[-*]\s+/, "").trim()}`);
      out.push("");
      continue;
    }
    para.push(line);
  }
  flushPara();
  return out.join("\n").replace(/\s+$/, "");
}

export function beautifyLlmResponse(text: string): string {
  let t = (text || "").trim();
  if (!t || t === UNKNOWN_POLICY_PHRASE) return t;
  t = stripInlineMarkdownNoise(t);
  t = stripHandbookLayoutArtifacts(t);

  const m = t.match(/^Sources:\s*$/im);
  let main: string;
  let sourcesRaw: string;
  if (m && m.index !== undefined) {
    main = t.slice(0, m.index).trim();
    sourcesRaw = t.slice(m.index).trim();
  } else {
    main = t.trim();
    sourcesRaw = "";
  }
  const mainFmt = formatMainBody(main);
  if (sourcesRaw) {
    const srcFmt = formatSourcesBlock(sourcesRaw);
    return `${mainFmt}\n\n${srcFmt}`.trim();
  }
  return mainFmt;
}

const MD_SOURCES_TAIL = /^###\s+sources\s*\n[\s\S]*$/im;
const PLAIN_SOURCES_TAIL = /\n\s*sources:\s*\n[\s\S]*$/is;

const TAIL_SOURCE_PAGE = /\s+source\s+section\b[\s\S]+?\bpage\s+number\b\s*(\d{1,5})\s*$/is;
const TAIL_SOURCE_PAGE_LOOSE = /\s+source\s+section\s+[\s\S]+\s+page\s+number\s+\d{1,5}\s*$/is;
const TAIL_PAGE_ONLY = /\s+page\s+number\s+(\d{1,5})\s*$/is;
const TAIL_SOURCE_SHORT = /\s+source\s+(?!section\b)[\s\S]+?\bpage\s+number\b\s*\d{1,5}\s*$/is;

export function stripTrailingSourcePageFooter(text: string): string {
  const t = (text || "").replace(/\s+$/, "");
  for (const re of [TAIL_SOURCE_PAGE, TAIL_SOURCE_PAGE_LOOSE, TAIL_SOURCE_SHORT, TAIL_PAGE_ONLY]) {
    const m = t.match(re);
    if (m && m.index !== undefined) return t.slice(0, m.index).replace(/\s+$/, "");
  }
  // Last resort: last " Source section " whose tail ends with "Page number N".
  const matches = [...t.matchAll(/\s+source\s+section\s+/gis)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const idx = matches[i].index!;
    const tail = t.slice(idx);
    if (/page\s+number\s+\d{1,5}\s*$/is.test(tail)) {
      return t.slice(0, idx).replace(/\s+$/, "");
    }
  }
  return t;
}

export function isFallbackAnswer(t: string): boolean {
  const s = (t || "").trim();
  if (!s) return true;
  if (s === UNKNOWN_POLICY_PHRASE) return true;
  const low = s.toLowerCase().replace(/\.+$/, "");
  return low === "contact the hr" || low === "contact the hr department";
}

function breakInlineBulletChunks(body: string): string {
  const b = (body || "").trim();
  if (!b.includes(" \u2022 ")) return b;
  const chunks = b.split(/\s+\u2022\s+/);
  if (chunks.length <= 1) return b;
  const head = chunks[0].trim();
  const bullets = chunks.slice(1).filter((c) => c.trim()).map((c) => `\u2022 ${c.trim()}`);
  if (!bullets.length) return b;
  return head + "\n\n" + bullets.join("\n");
}

function preprocessBodyForStructure(body: string): string {
  let t = (body || "").trim();
  if (!t) return t;
  t = breakInlineBulletChunks(t);
  t = t.replace(/([.!?])\s+\u2022\s+/g, "$1\n\u2022 ");
  t = t.replace(/([a-zA-Z0-9)%])\s+\u2022\s+/g, "$1\n\u2022 ");
  t = t.replace(/\.\s+&\s+/g, ".\n& ");
  return t;
}

export function cleanAnswerBodyOnly(answer: string, citations: Citation[]): string {
  let t = (answer || "").trim();
  if (!t || isFallbackAnswer(t)) return t;
  t = stripHandbookLayoutArtifacts(t);
  let body = stripTrailingSourcePageFooter(t);
  if (citations && citations.length) {
    body = body.replace(MD_SOURCES_TAIL, "").replace(/\s+$/, "");
    body = body.replace(PLAIN_SOURCES_TAIL, "").replace(/\s+$/, "");
  }
  body = breakInlineBulletChunks(body);
  body = body.replace(/([.!?])\s+\u2022\s+/g, "$1\n\n\u2022 ");
  body = body.replace(/([a-zA-Z0-9)%])\s+\u2022\s+/g, "$1\n\u2022 ");
  body = body.replace(/\.\s+&\s+/g, ".\n\n& ");
  return body.trim();
}

export function formatPlainAnswerWithMetadata(
  body: string,
  _citations: Citation[],
  appendSourceMetadata = true
): string {
  const b = (body || "").trim();
  if (!b) return b;
  if (isFallbackAnswer(b)) return b;
  if (!appendSourceMetadata) return b;
  return `${b}\n\n${CLOSING_LINE}`;
}

export function cleanAnswerPlainForClient(
  answer: string,
  citations: Citation[],
  appendSourceMetadata = true
): string {
  const body = cleanAnswerBodyOnly(answer, citations);
  if (!body || isFallbackAnswer(body)) return body;
  return formatPlainAnswerWithMetadata(body, citations, appendSourceMetadata);
}

function markdownishToHtml(body: string): string {
  const b = (body || "").trim();
  if (!b) return "";
  const lines = b.split(/\r?\n/);
  const parts: string[] = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i].replace(/\s+$/, "");
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const s = line.trim();
    if (s.startsWith("## ") && !s.startsWith("### ")) {
      parts.push(`<h2>${escapeHtml(s.slice(3).trim())}</h2>`);
      i += 1;
      continue;
    }
    if (s.startsWith("### ")) {
      parts.push(`<h3>${escapeHtml(s.slice(4).trim())}</h3>`);
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(s) || s.startsWith("\u2022")) {
      const items: string[] = [];
      while (i < n) {
        const ln = lines[i].trim();
        if (/^[-*]\s+/.test(ln)) {
          items.push(`<li>${escapeHtml(ln.replace(/^[-*]\s+/, "").trim())}</li>`);
          i += 1;
        } else if (ln.startsWith("\u2022")) {
          items.push(`<li>${escapeHtml(ln.replace(/^\u2022+/, "").trim())}</li>`);
          i += 1;
        } else if (!ln.trim()) {
          i += 1;
          break;
        } else {
          break;
        }
      }
      parts.push("<ul>" + items.join("") + "</ul>");
      continue;
    }
    if (/^\d+[.)]\s+/.test(s)) {
      const items: string[] = [];
      while (i < n) {
        const ln = lines[i].trim();
        const mnum = ln.match(/^(\d+)[.)]\s+(.*)$/);
        if (mnum) {
          items.push(`<li>${escapeHtml(mnum[2].trim())}</li>`);
          i += 1;
        } else if (!ln) {
          i += 1;
          break;
        } else {
          break;
        }
      }
      parts.push("<ol>" + items.join("") + "</ol>");
      continue;
    }
    const paraLines = [s];
    i += 1;
    while (i < n) {
      const nxt = lines[i].trim();
      if (!nxt) {
        i += 1;
        break;
      }
      if (nxt.startsWith("#") || /^[-*]\s+/.test(nxt) || nxt.startsWith("\u2022") || /^\d+[.)]\s+/.test(nxt)) {
        break;
      }
      paraLines.push(nxt);
      i += 1;
    }
    const ptext = paraLines.map((x) => x.trim()).filter(Boolean).join(" ");
    if (ptext) parts.push(`<p>${escapeHtml(ptext)}</p>`);
  }
  return parts.join("\n");
}

export function buildChatAnswerHtml(
  answer: string,
  citations: Citation[],
  appendSourceMetadata = true
): string {
  const t = (answer || "").trim();
  if (!t) return "";
  if (isFallbackAnswer(t)) {
    return `<div class="chat-answer"><p class="chat-answer-fallback">${escapeHtml(t)}</p></div>`;
  }
  let body = stripTrailingSourcePageFooter(t);
  if (citations && citations.length) {
    body = body.replace(MD_SOURCES_TAIL, "").replace(/\s+$/, "");
    body = body.replace(PLAIN_SOURCES_TAIL, "").replace(/\s+$/, "");
  }
  body = preprocessBodyForStructure(body);
  let inner = markdownishToHtml(body);
  if (!inner) inner = `<p>${escapeHtml(t)}</p>`;
  if (!appendSourceMetadata) return `<div class="chat-answer">\n${inner}\n</div>`;
  const meta =
    '<div class="chat-source-meta">' +
    `<p class="chat-answer-closing">${escapeHtml(CLOSING_LINE)}</p>` +
    "</div>";
  return `<div class="chat-answer">\n${inner}\n${meta}\n</div>`;
}
