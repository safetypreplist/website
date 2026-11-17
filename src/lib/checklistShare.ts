/** Checklist share helpers: quick PDF share + import JSON (upload feature-flagged). */

export type ShareChecklistItem = {
  text: string;
  checked: boolean;
  note: string;
};

export type SharePayload = {
  version: 1;
  title: string;
  sharedBy?: string;
  items: ShareChecklistItem[];
  exportedAt: string;
};

export const SHARE_IMPORT_ENABLED = String(import.meta.env.VITE_SHARE_IMPORT_ENABLED || "") === "true";

export const QUICK_SHARE_HELP = "Send the PDF. Anyone can open it, no app needed.";
export const IMPORT_SHARE_HELP =
  "Send a copy of your checklist. The person you send it to can open it in Safety Prep List and keep their own copy. Links expire after 3 days.";

function pdfEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Minimal multi-page Helvetica PDF from plain lines (no deps). */
export function buildTextPdf(title: string, lines: string[]): Blob {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const lineHeight = 14;
  const fontSize = 11;
  const titleSize = 16;
  const maxWidthChars = 86;

  function wrap(line: string): string[] {
    const out: string[] = [];
    let rest = line;
    while (rest.length > maxWidthChars) {
      let cut = rest.lastIndexOf(" ", maxWidthChars);
      if (cut < 40) cut = maxWidthChars;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) out.push(rest);
    return out.length ? out : [""];
  }

  const wrapped: string[] = [];
  for (const line of lines) wrapped.push(...wrap(line));

  const usable = pageHeight - margin * 2 - 28;
  const linesPerPage = Math.max(1, Math.floor(usable / lineHeight));
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push([""]);

  const objects: string[] = [];
  const offsets: number[] = [0];

  function addObj(body: string) {
    offsets.push(0); // filled later
    objects.push(body);
    return objects.length;
  }

  const fontId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  for (const pageLines of pages) {
    const contentParts = [`BT /F1 ${titleSize} Tf ${margin} ${pageHeight - margin} Td (${pdfEscape(title)}) Tj`];
    contentParts.push(`/F1 ${fontSize} Tf 0 -24 Td`);
    pageLines.forEach((line, idx) => {
      if (idx === 0) contentParts.push(`(${pdfEscape(line)}) Tj`);
      else contentParts.push(`0 -${lineHeight} Td (${pdfEscape(line)}) Tj`);
    });
    contentParts.push("ET");
    const stream = contentParts.join("\n");
    const contentId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
    const pageId = addObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    pageIds.push(pageId);
  }

  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  const pagesId = addObj(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pageIds.length} >>`);
  // Patch Parent refs
  for (let i = 0; i < pageIds.length; i++) {
    const idx = pageIds[i]! - 1;
    objects[idx] = objects[idx]!.replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }
  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const finalOffsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    finalOffsets[i + 1] = pdf.length;
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(finalOffsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
  pdf += `startxref\n${xrefAt}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function buildSharePayload(input: {
  title: string;
  sharedBy?: string;
  items: ShareChecklistItem[];
}): SharePayload {
  return {
    version: 1,
    title: input.title,
    ...(input.sharedBy ? { sharedBy: input.sharedBy } : {}),
    items: input.items.map((item) => ({
      text: item.text,
      checked: Boolean(item.checked),
      note: item.note || "",
    })),
    exportedAt: new Date().toISOString(),
  };
}

export function sharePayloadToFile(payload: SharePayload): File {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const safe = payload.title.replace(/[^\w\-]+/g, "_").slice(0, 40) || "checklist";
  return new File([blob], `${safe}-share.json`, { type: "application/json" });
}

export async function shareOrDownloadFile(file: File, title: string, text: string) {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], title, text });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Upload share payload when VITE_SHARE_IMPORT_ENABLED=true.
 * Stub: no server endpoint in Phase 2 — throws a clear error so callers can show "coming soon".
 */
export async function uploadShareForImport(_payload: SharePayload): Promise<{ url: string }> {
  if (!SHARE_IMPORT_ENABLED) {
    throw new Error("Share-for-import upload is not enabled yet.");
  }
  // Phase 3+ server endpoint — intentionally not implemented.
  throw new Error("Share-for-import upload endpoint is not available yet.");
}

export function parseSharePayload(raw: unknown): SharePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1 || typeof obj.title !== "string" || !Array.isArray(obj.items)) return null;
  const items: ShareChecklistItem[] = [];
  for (const row of obj.items) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.text !== "string") continue;
    items.push({
      text: item.text,
      checked: Boolean(item.checked),
      note: typeof item.note === "string" ? item.note : "",
    });
  }
  return {
    version: 1,
    title: obj.title,
    sharedBy: typeof obj.sharedBy === "string" ? obj.sharedBy : undefined,
    items,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(),
  };
}
