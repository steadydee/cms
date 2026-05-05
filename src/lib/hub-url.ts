export function getHubBaseUrl(): string {
  const configured = process.env.OW_PARTNERS_HUB_URL?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "https://hub.owlswatch.com" : "http://localhost:3000";
}

export function getHubLaunchUrl(moduleKey: string): string {
  return new URL(`/launch/${moduleKey}`, getHubBaseUrl()).toString();
}
