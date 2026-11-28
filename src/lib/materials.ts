export const MATERIAL_BUCKET = "study-materials";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_SELECTED_FILES = 3;
export const FILE_ACCEPT = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp";
export const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};
export interface StudyMaterial { path: string; name: string; size: number; createdAt: string }
export interface ModelAttachment { name: string; mime: string; data?: string; text?: string; notice?: string }
export function fileMime(name: string) { return MIME_BY_EXT[name.split(".").pop()?.toLowerCase() ?? ""] ?? null; }
export function validateMaterial(name: string, size: number) {
  if (name.toLowerCase().endsWith(".doc")) return "Save this older Word document as .DOCX, then upload it.";
  if (!fileMime(name)) return "Choose a PDF, DOCX, TXT, JPG, PNG or WEBP file.";
  if (size <= 0 || size > MAX_FILE_BYTES) return "Each file must be between 1 byte and 10 MB.";
  return null;
}
export const NOTES_ACTIONS = [
  ["Summarise my notes", "Summarise the attached notes, covering each main topic."],
  ["Explain simply", "Explain these notes in simple language from first principles."],
  ["Detailed revision notes", "Create detailed revision notes from these materials with section references."],
  ["Concepts & definitions", "Extract the important concepts and definitions from these materials."],
  ["Important formulas", "Extract important formulas with meanings of symbols, units and worked examples."],
  ["Practice questions", "Generate five practice questions with worked answers from these materials."],
  ["Revision sheet", "Create a concise revision sheet with summaries, definitions, formulas and common mistakes."],
  ["Topics to revise", "Identify topics covered in these materials to revise; do not infer my knowledge without evidence."],
] as const;
/** Keep the opening and relevant paragraph chunks, bounded before sending to the model. */
export function relevantText(text: string, question: string, limit = 60000) {
  if (text.length <= limit) return { text, partial: false };
  const terms = question.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const chunks = Array.from({ length: Math.ceil(text.length / 3000) }, (_, i) => ({ i, text: text.slice(i * 3000, (i + 1) * 3000) }));
  const selected = chunks.map(c => ({ ...c, score: c.i === 0 ? 100 : terms.reduce((n, t) => n + (c.text.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i).slice(0, Math.floor(limit / 3100)).sort((a,b) => a.i - b.i);
  return { text: selected.map(c => `[Text section ${c.i + 1}]\n${c.text}`).join("\n"), partial: true };
}
export function questionKey(prompt: string) { return prompt.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
