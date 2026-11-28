import type { ModelAttachment } from "./materials";
export function directParts(text: string, files: ModelAttachment[]) {
  return [
    { text },
    ...files.flatMap(f => f.text ? [{ text: `SOURCE FILE: ${f.name}\n${f.text}` }] : [
      { text: `SOURCE FILE: ${f.name}` },
      { inlineData: { mimeType: f.mime, data: f.data ?? "" } },
    ]),
  ];
}
export function gatewayContent(text: string, files: ModelAttachment[]) {
  return [
    { type: "text" as const, text },
    ...files.map(f => f.text
      ? { type: "text" as const, text: `SOURCE FILE: ${f.name}\n${f.text}` }
      : f.mime.startsWith("image/")
        ? { type: "image_url" as const, image_url: { url: `data:${f.mime};base64,${f.data}` } }
        : { type: "file" as const, file: { filename: f.name, file_data: `data:${f.mime};base64,${f.data}` } }),
  ];
}
