export class GmailApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    response: string,
  ) {
    super(`Gmail API request failed (${status}): ${response}`);
    this.name = "GmailApiError";
  }
}

export function isMissingGmailResource(error: unknown, path: string) {
  return error instanceof GmailApiError
    && error.status === 404
    && error.method === "GET"
    && error.path.split("?")[0] === path;
}

// History can reference mail deleted before the sync reads it. Preserve its CMS history.
export async function readGmailSyncItem<T>(path: string, read: () => Promise<T>): Promise<T | null> {
  if (!/^(messages|threads)\/[^/?]+$/.test(path)) {
    throw new Error("Only individual Gmail messages and threads may be skipped during sync");
  }
  try {
    return await read();
  } catch (error) {
    if (isMissingGmailResource(error, path)) return null;
    throw error;
  }
}
