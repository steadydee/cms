export function normalizeEmailTemplateBody(value: string) {
  return value
    .replaceAll("\r\n", "\n")
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n");
}
