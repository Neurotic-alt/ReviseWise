import { GatewayError, generateChatCompletion } from "@lovable.dev/ai-gateway";
import {
  GEMINI_DIRECT_MODELS,
  GEMINI_DIRECT_TIMEOUT_MS,
  GEMINI_GATEWAY_MODEL,
  geminiThinking,
  PRACTICE_SCHEMA,
  buildSystemPrompt,
  trimHistory,
  type TutorRequest,
} from "./tutor-prompt";

/** Calls Google's Gemini API with the project's GEMINI_API_KEY. Throws on any failure. */
async function askGeminiDirect(req: TutorRequest, model: string): Promise<string> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const practice = req.mode === "practice";

  const contents = [
    ...trimHistory(req.history).map((t) => ({
      role: t.role === "student" ? "user" : "model",
      parts: [{ text: t.text }],
    })),
    { role: "user", parts: [{ text: req.question }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(GEMINI_DIRECT_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(req) }] },
        contents,
        generationConfig: {
          ...geminiThinking(model),
          ...(practice
            ? { responseMimeType: "application/json", responseJsonSchema: PRACTICE_SCHEMA }
            : {}),
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) throw new Error("Gemini API returned an empty reply");
  return text;
}

/** Backup route: the same Gemini model through the Lovable AI Gateway (LOVABLE_API_KEY). */
async function askGeminiViaGateway(req: TutorRequest): Promise<string> {
  const history = trimHistory(req.history).map((t) => ({
    role: t.role === "student" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));
  const completion = await generateChatCompletion({
    model: GEMINI_GATEWAY_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(req) },
      ...history,
      { role: "user", content: req.question },
    ],
    ...(req.mode === "practice"
      ? {
          response_format: {
            type: "json_schema" as const,
            json_schema: { name: "practice_question", schema: PRACTICE_SCHEMA, strict: true },
          },
        }
      : {}),
  });
  const content = completion.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw new Error("Gateway returned an empty reply");
  return text;
}

export type TutorRoute = "gemini" | "gateway";

/** Tries the student's own Gemini key first, then the Lovable gateway. */
export async function askTutor(req: TutorRequest): Promise<{ text: string; route: TutorRoute }> {
  for (const model of GEMINI_DIRECT_MODELS) {
    try {
      return { text: await askGeminiDirect(req, model), route: "gemini" };
    } catch (directError) {
      console.error(`[tutor] ${model} failed:`, String(directError).slice(0, 160));
    }
  }
  try {
    return { text: await askGeminiViaGateway(req), route: "gateway" };
  } catch (gatewayError) {
    if (gatewayError instanceof GatewayError) {
      console.error("[tutor] backup failed:", gatewayError.code, gatewayError.httpStatus, gatewayError.ids);
    } else {
      console.error("[tutor] backup failed:", String(gatewayError));
    }
    throw new Error("TUTOR_UNAVAILABLE");
  }
}
