import { generateChatCompletion } from "@lovable.dev/ai-gateway";
import { QUIZ_GATEWAY_MODEL, QUIZ_SCHEMA } from "./quiz-ai";
import { GEMINI_DIRECT_MODELS, QUIZ_DIRECT_TIMEOUT_MS, geminiThinking } from "./tutor-prompt";

const SYSTEM = "You are ReviseWise, an accurate quiz writer for school students aged 13 to 18.";

async function direct(prompt: string, model: string): Promise<string> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(QUIZ_DIRECT_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          ...geminiThinking(model),
          responseMimeType: "application/json",
          responseJsonSchema: QUIZ_SCHEMA,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) throw new Error("empty reply");
  return text;
}

async function gateway(prompt: string): Promise<string> {
  const c = await generateChatCompletion({
    model: QUIZ_GATEWAY_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema" as const,
      json_schema: { name: "quiz", schema: QUIZ_SCHEMA, strict: true },
    },
  });
  const content = c.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw new Error("empty reply");
  return text;
}

/** Gemini key first, Lovable AI Gateway as backup. */
export async function generateQuizText(prompt: string): Promise<string> {
  for (const model of GEMINI_DIRECT_MODELS) {
    try {
      return await direct(prompt, model);
    } catch (e) {
      console.error(`[quiz] ${model} failed:`, String(e).slice(0, 160));
    }
  }
  return gateway(prompt);
}
