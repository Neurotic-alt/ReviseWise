import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MATERIAL_BUCKET, MAX_SELECTED_FILES, fileMime, validateMaterial, type StudyMaterial } from "./materials";
import { tutorInputSchema, type AskTutorResult } from "./tutor.functions";
import { parsePracticeReply } from "./tutor-prompt";

const pathsSchema = z.array(z.string().max(300)).min(1).max(MAX_SELECTED_FILES);
export const uploadMaterialFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Choose a file.");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file.");
    const error = validateMaterial(file.name, file.size);
    if (error) throw new Error(error);
    return file;
  }).handler(async ({ data: file, context }): Promise<StudyMaterial> => {
    const { assertSignature, extractWord } = await import("./materials.server");
    const mime = fileMime(file.name);
    if (!mime) throw new Error("Unsupported file.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertSignature(bytes, mime);
    if (mime.includes("wordprocessingml")) extractWord(bytes);
    const existing = await context.supabase.storage.from(MATERIAL_BUCKET).list(context.userId, { limit: 51 });
    if (existing.error) throw new Error("File storage is unavailable.");
    if ((existing.data?.length ?? 0) >= 50) throw new Error("Your library holds 50 files. Remove one before uploading.");
    const name = file.name.replace(/[^\p{L}\p{N} ._-]/gu, "_").slice(-120);
    const path = `${context.userId}/${crypto.randomUUID()}--${name}`;
    const { error } = await context.supabase.storage.from(MATERIAL_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error("Couldn't save your file. Please try again.");
    return { path, name, size: file.size, createdAt: new Date().toISOString() };
  });
export const listMaterialsFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudyMaterial[]> => {
    const { data, error } = await context.supabase.storage.from(MATERIAL_BUCKET).list(context.userId, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new Error("Couldn't load your materials.");
    return (data ?? []).filter(f => f.name.includes("--")).map(f => ({ path: `${context.userId}/${f.name}`, name: f.name.split("--").slice(1).join("--"), size: Number(f.metadata?.['size'] ?? 0), createdAt: f.created_at ?? "" }));
  });
export const removeMaterialFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.string().max(300).parse(d)).handler(async ({ data, context }) => {
    if (!data.startsWith(`${context.userId}/`) || data.includes("..")) throw new Error("File access denied.");
    const { error } = await context.supabase.storage.from(MATERIAL_BUCKET).remove([data]);
    if (error) throw new Error("Couldn't remove your file.");
    return { ok: true };
  });
export const askMaterialFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ request: tutorInputSchema, paths: pathsSchema }).parse(d))
  .handler(async ({ data, context }): Promise<AskTutorResult & { notices?: string[] }> => {
    const { loadMaterials } = await import("./materials.server");
    const { askTutor } = await import("./tutor.server");
    try {
      const files = await loadMaterials(context.supabase, context.userId, data.paths, data.request.question);
      const { text, route } = await askTutor({ ...data.request, subjectName: data.request.subjectName || "Uploaded material" }, files);
      const notices = files.flatMap(f => f.notice ? [f.notice] : []);
      if (data.request.mode === "practice") {
        const parsed = parsePracticeReply(text, data.request.subjectId, data.request.subjectName);
        return parsed ? { ok: true, text: parsed.intro, practice: parsed.question, route, notices } : { ok: false, error: "bad-practice" };
      }
      return { ok: true, text, route, notices };
    } catch { return { ok: false, error: "unavailable" }; }
  });

export const generateMaterialQuizFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(async (d: unknown) => {
    const { quizInputSchema } = await import("./quiz.functions");
    return z.object({ request: quizInputSchema, paths: pathsSchema }).parse(d);
  }).handler(async ({ data, context }) => {
    const { loadMaterials } = await import("./materials.server");
    const { generateQuizText } = await import("./quiz-ai.server");
    const { buildQuizPrompt, parseQuizReply } = await import("./quiz-ai");
    try {
      const files = await loadMaterials(context.supabase, context.userId, data.paths, data.request.topics.map(t => t.topicName).join(" "));
      const prompt = buildQuizPrompt(data.request.topics, data.request.count, { exam: data.request.exam, level: data.request.level }, data.request.exclude);
      const raw = await generateQuizText(prompt + "\nBase every question on the attached source material. Do not invent facts absent from it.", files);
      const questions = parseQuizReply(raw, data.request.topics, data.request.count);
      return questions.length === data.request.count ? { ok: true as const, questions } : { ok: false as const };
    } catch { return { ok: false as const }; }
  });
