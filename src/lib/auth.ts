import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export type PartnersRole = "staff" | "manager" | "admin";
export type PartnersAccessLevel = "read" | "write" | "admin";

export type PartnersRequestContext = {
  userId: string;
  userName: string;
  email?: string;
  role: PartnersRole;
  propertyId: string;
  source: "shell" | "agent" | "dev";
  actorType?: "human" | "agent";
  permissions?: string[];
  allowedToolClassifications?: string[];
  credentialId?: string;
};

type PartnersSession = PartnersRequestContext & {
  issuedAt: number;
  expiresAt: number;
};

type HubHandoffPayload = {
  iss: string;
  aud: string;
  sub: string;
  name: string;
  email?: string;
  role: PartnersRole;
  propertyId: string;
  iat: number;
  exp: number;
};

type HubAgentPayload = {
  iss: string;
  typ: string;
  aud: string;
  agentId: string;
  credentialId: string;
  actorLabel: string;
  permissions: string[];
  propertyIds: string[];
  allowedToolClassifications: string[];
  activePropertyId: string | null;
  iat: number;
  exp: number;
  jti: string;
};

type AccessResult =
  | { ok: true; context: PartnersRequestContext }
  | { ok: false; status: 401 | 403; message: string };

const PARTNERS_SESSION_COOKIE = "ow_partners_session";
const PARTNERS_SESSION_TTL_SECONDS = 60 * 60 * 12;

const ROLE_RANK: Record<PartnersRole, number> = {
  staff: 1,
  manager: 2,
  admin: 3,
};

const ACCESS_MIN_ROLE: Record<PartnersAccessLevel, PartnersRole> = {
  read: "staff",
  write: "staff",
  admin: "admin",
};

function normalizeRole(value: string | null | undefined): PartnersRole | null {
  if (value === "staff" || value === "manager" || value === "admin") return value;
  return null;
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
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function hasRequiredAccess(role: PartnersRole, level: PartnersAccessLevel): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[ACCESS_MIN_ROLE[level]];
}

function hasRequiredAgentPermission(permissions: string[] | undefined, level: PartnersAccessLevel): boolean {
  const values = new Set(permissions ?? []);
  if (values.has("partners.admin")) return true;

  const permissionValues = Array.from(values);
  if (level === "read") {
    return permissionValues.some((value) => value.endsWith(".read") || value.endsWith(".write") || value.endsWith(".send"));
  }

  if (level === "write") {
    return permissionValues.some((value) => value.endsWith(".write") || value.endsWith(".send"));
  }

  return false;
}

function getPartnersSessionSecret(): string {
  if (process.env.OW_PARTNERS_SESSION_SECRET?.trim()) return process.env.OW_PARTNERS_SESSION_SECRET.trim();
  if (process.env.OW_INTERNAL_SHARED_SECRET?.trim()) return process.env.OW_INTERNAL_SHARED_SECRET.trim();
  if (process.env.NODE_ENV !== "production") return "ow-partners-dev-session-secret";
  throw new Error("OW_PARTNERS_SESSION_SECRET or OW_INTERNAL_SHARED_SECRET is required in production");
}

function getModuleHandoffSecret(): string {
  if (process.env.OW_MODULE_HANDOFF_SECRET?.trim()) return process.env.OW_MODULE_HANDOFF_SECRET.trim();
  if (process.env.OW_INTERNAL_SHARED_SECRET?.trim()) return process.env.OW_INTERNAL_SHARED_SECRET.trim();
  if (process.env.NODE_ENV !== "production") return "ow-module-dev-handoff-secret";
  throw new Error("OW_MODULE_HANDOFF_SECRET or OW_INTERNAL_SHARED_SECRET is required in production");
}

function getAgentTokenSecret(): string {
  if (process.env.OW_AGENT_TOKEN_SECRET?.trim()) return process.env.OW_AGENT_TOKEN_SECRET.trim();
  if (process.env.OW_INTERNAL_SHARED_SECRET?.trim()) return process.env.OW_INTERNAL_SHARED_SECRET.trim();
  if (process.env.NODE_ENV !== "production") return "ow-agent-dev-token-secret";
  throw new Error("OW_AGENT_TOKEN_SECRET or OW_INTERNAL_SHARED_SECRET is required in production");
}

async function getCookieContext(): Promise<PartnersRequestContext | null> {
  const token = (await cookies()).get(PARTNERS_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyPayload<PartnersSession>(token, getPartnersSessionSecret());
  if (!payload || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;

  return {
    userId: payload.userId,
    userName: payload.userName,
    email: payload.email,
    role: payload.role,
    propertyId: payload.propertyId,
    source: payload.source,
    actorType: "human",
  };
}

async function getAgentContext(): Promise<PartnersRequestContext | null> {
  const requestHeaders = await headers();
  const authHeader = requestHeaders.get("authorization") ?? requestHeaders.get("Authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;

  const payload = verifyPayload<HubAgentPayload>(token.trim(), getAgentTokenSecret());
  if (!payload) return null;
  if (payload.typ !== "agent_access") return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (payload.iss !== "owhub") return null;
  if (payload.aud !== "partners") return null;
  if (!payload.activePropertyId) return null;

  const propertyAllowed = payload.propertyIds.includes("*") || payload.propertyIds.includes(payload.activePropertyId);
  if (!propertyAllowed) return null;

  return {
    userId: payload.agentId,
    userName: payload.actorLabel,
    email: undefined,
    role: "admin",
    propertyId: payload.activePropertyId,
    source: "agent",
    actorType: "agent",
    permissions: payload.permissions,
    allowedToolClassifications: payload.allowedToolClassifications,
    credentialId: payload.credentialId,
  };
}

async function getDevContext(): Promise<PartnersRequestContext | null> {
  if (process.env.NODE_ENV === "production") return null;

  return {
    userId: process.env.OW_PARTNERS_DEV_USER_ID?.trim() || "dev-partners-user",
    userName: process.env.OW_PARTNERS_DEV_USER_NAME?.trim() || "Local Owl's Watch employee",
    email: undefined,
    role: normalizeRole(process.env.OW_PARTNERS_DEV_ROLE?.trim()) ?? "admin",
    propertyId: process.env.OW_PARTNERS_DEV_PROPERTY_ID?.trim() || "owlswatch",
    source: "dev",
    actorType: "human",
  };
}

export async function getPartnersRequestContext(): Promise<PartnersRequestContext | null> {
  const cookieContext = await getCookieContext();
  if (cookieContext) return cookieContext;

  const agentContext = await getAgentContext();
  if (agentContext) return agentContext;

  return getDevContext();
}

export async function authorizePartnersAccess(level: PartnersAccessLevel): Promise<AccessResult> {
  const context = await getPartnersRequestContext();
  if (!context) {
    return { ok: false, status: 401, message: "Partners requires Owl's Watch employee or machine context" };
  }

  if (context.source === "agent") {
    if (!hasRequiredAgentPermission(context.permissions, level)) {
      return { ok: false, status: 403, message: "This machine actor does not have enough Partners scope" };
    }
    return { ok: true, context };
  }

  if (!hasRequiredAccess(context.role, level)) {
    return { ok: false, status: 403, message: `This action requires ${ACCESS_MIN_ROLE[level]} access` };
  }

  return { ok: true, context };
}

export async function createPartnersSessionFromHandoff(token: string): Promise<PartnersRequestContext> {
  const payload = verifyPayload<HubHandoffPayload>(token, getModuleHandoffSecret());
  if (!payload) throw new Error("Invalid Owl's Watch handoff token");
  if (payload.iss !== "owhub" || payload.aud !== "partners") {
    throw new Error("This handoff token is not meant for Partners");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.iat > now + 60) {
    throw new Error("This handoff token has expired");
  }

  const context: PartnersRequestContext = {
    userId: payload.sub,
    userName: payload.name,
    email: payload.email,
    role: payload.role,
    propertyId: payload.propertyId,
    source: "shell",
    actorType: "human",
  };

  const session: PartnersSession = {
    ...context,
    issuedAt: now,
    expiresAt: now + PARTNERS_SESSION_TTL_SECONDS,
  };

  (await cookies()).set({
    name: PARTNERS_SESSION_COOKIE,
    value: signPayload(session, getPartnersSessionSecret()),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PARTNERS_SESSION_TTL_SECONDS,
  });

  return context;
}
