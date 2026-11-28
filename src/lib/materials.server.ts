import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { MATERIAL_BUCKET, fileMime, validateMaterial, relevantText, type ModelAttachment } from "./materials";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function assertSignature(bytes: Uint8Array, mime: string) {
  const start = new TextDecoder().decode(bytes.slice(0, 12));
  const valid = mime === "application/pdf" ? start.startsWith("%PDF-")
    : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : mime === "image/png" ? bytes[0] === 137 && start.slice(1,4) === "PNG"
    : mime === "image/webp" ? start.startsWith("RIFF") && start.slice(8,12) === "WEBP"
    : mime.includes("wordprocessingml") ? start.startsWith("PK")
    : mime === "text/plain" ? !bytes.slice(0, 4096).includes(0) : false;
  if (!valid) throw new Error("The file contents don't match its type.");
}
export function extractWord(bytes: Uint8Array) {
  const entries = unzipSync(bytes, { filter: e => e.name === "word/document.xml" && e.originalSize < 8 * 1024 * 1024 });
  const document = entries["word/document.xml"];
  if (!document) throw new Error("This Word file is invalid or too large. Export it as PDF.");
  const xml = strFromU8(document);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsupported Word contents.");
  const tree: unknown = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, isArray: tag => ["p", "r", "t"].includes(tag) }).parse(xml);
  const paragraphs: string[] = [];
  const visit = (node: unknown): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(visit).join("");
    if (!node || typeof node !== "object") return "";
    const obj = node as Record<string, unknown>;
    if ("p" in obj) {
      const ps = Array.isArray(obj["p"]) ? obj["p"] : [obj["p"]];
      for (const p of ps) paragraphs.push(visit(p));
    }
    if ("t" in obj) return visit(obj["t"]);
    return Object.entries(obj).filter(([k]) => k !== "p").map(([,v]) => visit(v)).join("");
  };
  visit(tree);
  return paragraphs.map((p,i) => `[Paragraph ${i+1}] ${p}`).join("\n");
}
export async function loadMaterials(db: SupabaseClient<Database>, uid: string, paths: string[], question: string): Promise<ModelAttachment[]> {
  const out: ModelAttachment[] = [];
  let total = 0;
  for (const path of [...new Set(paths)]) {
    if (!path.startsWith(`${uid}/`) || path.includes("..") || path.split("/").length !== 2) throw new Error("File access denied.");
    const name = path.split("--").slice(1).join("--");
    const mime = fileMime(name);
    if (!mime) throw new Error("Unsupported material.");
    const { data, error } = await db.storage.from(MATERIAL_BUCKET).download(path);
    if (error || !data) throw new Error("Couldn't read your file. Please upload it again.");
    if (validateMaterial(name, data.size)) throw new Error("Invalid file size.");
    total += data.size;
    if (total > 18 * 1024 * 1024) throw new Error("Selected files exceed 18 MB. Choose fewer files.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    assertSignature(bytes, mime);
    if (mime === "text/plain" || mime.includes("wordprocessingml")) {
      const raw = mime === "text/plain" ? new TextDecoder().decode(bytes) : extractWord(bytes);
      if (!raw.trim()) throw new Error("No text found; upload a PDF or photo instead.");
      const selected = relevantText(raw, question);
      out.push({ name, mime: "text/plain", text: selected.text, ...(selected.partial ? { notice: `${name}: only relevant text sections are included; ask about a specific section for more.` } : {}) });
    } else out.push({ name, mime, data: Buffer.from(bytes).toString("base64") });
  }
  return out;
}
