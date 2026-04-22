import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const GMAIL_SYNC_LABEL = "Owls Watch / Partners";

type GmailClientConfig = {
  clientId: string;
  clientSecret: string;
};

type OAuthStatePayload = {
  propertyId: string;
  userId: string;
  returnTo: string;
  iat: number;
  exp: number;
};

type GmailTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GmailLabel = {
  id: string;
  name: string;
};

type GmailHeader = {
  name: string;
  value: string;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    filename?: string;
    headers?: GmailHeader[];
    body?: {
      size?: number;
      data?: string;
      attachmentId?: string;
    };
    parts?: GmailMessage["payload"][];
  };
};

type GmailSendResponse = {
  id: string;
  threadId: string;
};

type GmailMessagesListResponse = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailHistoryResponse = {
  history?: Array<{
    id: string;
    messages?: Array<{ id: string; threadId: string }>;
    messagesAdded?: Array<{ message: { id: string; threadId: string } }>;
  }>;
  historyId?: string;
  nextPageToken?: string;
};

type GmailProfile = {
  emailAddress: string;
  historyId?: string;
  messagesTotal?: number;
  threadsTotal?: number;
};

function getOAuthSecret() {
  const value = process.env.OW_PARTNERS_GMAIL_TOKEN_SECRET?.trim()
    || process.env.OW_INTERNAL_SHARED_SECRET?.trim()
    || process.env.OW_PARTNERS_SESSION_SECRET?.trim();

  if (value) return value;
  if (process.env.NODE_ENV !== "production") return "ow-partners-gmail-dev-secret";
  throw new Error("OW_PARTNERS_GMAIL_TOKEN_SECRET, OW_INTERNAL_SHARED_SECRET, or OW_PARTNERS_SESSION_SECRET is required");
}

function createSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signPayload(payload: object, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${createSignature(encodedPayload, secret)}`;
}

function verifyPayload<T>(token: string, secret: string): T | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = createSignature(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function getTokenEncryptionKey() {
  return createHash("sha256").update(getOAuthSecret()).digest();
}

function encodeSubject(subject: string) {
  if (!subject) return "";
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToSimpleHtml(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function normalizeRawBase64(value: string) {
  return value.replaceAll("-", "+").replaceAll("_", "/");
}

function decodeBase64Url(value: string) {
  return Buffer.from(normalizeRawBase64(value), "base64").toString("utf8");
}

function sanitizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isGmailConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function getGmailClientConfig(): GmailClientConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Gmail");
  }

  return { clientId, clientSecret };
}

export function createGmailOAuthState(input: {
  propertyId: string;
  userId: string;
  returnTo: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  return signPayload(
    {
      propertyId: input.propertyId,
      userId: input.userId,
      returnTo: input.returnTo,
      iat: now,
      exp: now + 60 * 10,
    } satisfies OAuthStatePayload,
    getOAuthSecret()
  );
}

export function verifyGmailOAuthState(token: string): OAuthStatePayload | null {
  const payload = verifyPayload<OAuthStatePayload>(token, getOAuthSecret());
  if (!payload) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function encryptRefreshToken(refreshToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptRefreshToken(payload: string) {
  const [ivPart, authTagPart, encryptedPart] = payload.split(".");
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error("Invalid encrypted refresh token");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

async function gmailFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export function buildGmailConnectUrl(input: {
  origin: string;
  state: string;
}) {
  const { clientId } = getGmailClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${input.origin}/auth/gmail/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" "),
    state: input.state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGmailCode(input: {
  origin: string;
  code: string;
}): Promise<GmailTokenResponse> {
  const { clientId, clientSecret } = getGmailClientConfig();
  const params = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${input.origin}/auth/gmail/callback`,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<GmailTokenResponse>;
}

export async function refreshGmailAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGmailClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${text}`);
  }

  const payload = await response.json() as GmailTokenResponse;
  if (!payload.access_token) {
    throw new Error("Google token refresh did not return an access token");
  }

  return payload;
}

export async function getGmailProfile(accessToken: string) {
  return gmailFetch<GmailProfile>(accessToken, "profile");
}

export async function listGmailLabels(accessToken: string) {
  const response = await gmailFetch<{ labels?: GmailLabel[] }>(accessToken, "labels");
  return response.labels ?? [];
}

export async function createGmailLabel(accessToken: string, labelName: string) {
  return gmailFetch<GmailLabel>(accessToken, "labels", {
    method: "POST",
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
}

export async function ensureGmailLabel(accessToken: string, labelName = GMAIL_SYNC_LABEL) {
  const labels = await listGmailLabels(accessToken);
  const existing = labels.find((label) => label.name === labelName);
  if (existing) return existing;
  return createGmailLabel(accessToken, labelName);
}

export async function listRecentGmailMessages(accessToken: string, maxResults = 50) {
  const params = new URLSearchParams({
    maxResults: String(Math.max(1, Math.min(maxResults, 100))),
  });

  return gmailFetch<GmailMessagesListResponse>(accessToken, `messages?${params.toString()}`);
}

export async function listGmailHistory(accessToken: string, startHistoryId: string) {
  const params = new URLSearchParams({
    startHistoryId,
    maxResults: "100",
  });

  return gmailFetch<GmailHistoryResponse>(accessToken, `history?${params.toString()}`);
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  return gmailFetch<GmailMessage>(accessToken, `messages/${messageId}?format=full`);
}

export async function sendGmailRawMessage(accessToken: string, input: { raw: string; threadId?: string }) {
  return gmailFetch<GmailSendResponse>(accessToken, "messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw: input.raw,
      threadId: input.threadId,
    }),
  });
}

export async function addLabelToGmailMessage(accessToken: string, messageId: string, labelId: string) {
  await gmailFetch<{ id: string }>(accessToken, `messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: [labelId],
    }),
  });
}

export function buildRawGmailMessage(input: {
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string | null;
  references?: string[];
}) {
  const boundary = `ow-partners-${randomBytes(12).toString("hex")}`;
  const headers = [
    `From: ${input.fromEmail}`,
    `To: ${input.toEmail}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
  }

  if (input.references?.length) {
    headers.push(`References: ${input.references.join(" ")}`);
  }

  const rawMessage = [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.bodyText,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    textToSimpleHtml(input.bodyText),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return Buffer.from(rawMessage, "utf8").toString("base64url");
}

export function parseGmailMessageBody(message: GmailMessage) {
  const textParts: string[] = [];
  const htmlParts: string[] = [];

  function walkPart(part: NonNullable<GmailMessage["payload"]>) {
    const mimeType = part.mimeType?.toLowerCase() || "";
    const data = part.body?.data ? decodeBase64Url(part.body.data) : "";

    if (mimeType === "text/plain" && data) {
      textParts.push(data);
    }

    if (mimeType === "text/html" && data) {
      htmlParts.push(data);
    }

    for (const child of part.parts ?? []) {
      if (child) {
        walkPart(child);
      }
    }
  }

  if (message.payload) {
    walkPart(message.payload);
  }

  if (textParts.length === 0 && message.payload?.body?.data) {
    textParts.push(decodeBase64Url(message.payload.body.data));
  }

  return {
    text: textParts.join("\n\n").trim(),
    html: htmlParts.join("\n").trim() || null,
  };
}

export function getGmailHeader(message: GmailMessage, name: string) {
  const target = name.toLowerCase();
  return message.payload?.headers?.find((header) => header.name.toLowerCase() === target)?.value ?? null;
}

export function parseAddressHeader(value: string | null | undefined) {
  if (!value) return [];

  const results: Array<{ email: string; name?: string }> = [];
  const pattern = /(?:"?([^"]*)"?\s)?<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/gi;

  for (const match of value.matchAll(pattern)) {
    const email = sanitizeEmail(match[2] || "");
    if (!email) continue;
    const name = match[1]?.trim() || undefined;
    results.push({ email, name });
  }

  return results;
}

export function extractGmailParticipants(message: GmailMessage) {
  const from = parseAddressHeader(getGmailHeader(message, "from"));
  const to = parseAddressHeader(getGmailHeader(message, "to"));
  const cc = parseAddressHeader(getGmailHeader(message, "cc"));

  const unique = new Map<string, { email: string; name?: string }>();
  for (const item of [...from, ...to, ...cc]) {
    unique.set(item.email, item);
  }

  return {
    from,
    to,
    cc,
    allEmails: Array.from(unique.keys()),
  };
}
