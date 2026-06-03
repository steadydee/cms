const LIVE_EMAIL_SENDS_FLAG = "OW_PARTNERS_ALLOW_LIVE_EMAIL_SENDS";

type EmailSafetyEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  VERCEL_TARGET_ENV?: string;
  [LIVE_EMAIL_SENDS_FLAG]?: string;
};

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

export function getEmailRuntimeLabel(env: EmailSafetyEnv = process.env) {
  return normalized(env.VERCEL_TARGET_ENV)
    || normalized(env.VERCEL_ENV)
    || normalized(env.NODE_ENV)
    || "unknown";
}

export function isProductionEmailRuntime(env: EmailSafetyEnv = process.env) {
  const target = normalized(env.VERCEL_TARGET_ENV);
  if (target) return target === "production";

  const vercel = normalized(env.VERCEL_ENV);
  if (vercel) return vercel === "production";

  return normalized(env.NODE_ENV) === "production";
}

export function areLiveEmailSendsAllowed(env: EmailSafetyEnv = process.env) {
  if (normalized(env[LIVE_EMAIL_SENDS_FLAG]) === "true") return true;
  return isProductionEmailRuntime(env);
}

export function assertLiveEmailSendsAllowed(env: EmailSafetyEnv = process.env) {
  if (areLiveEmailSendsAllowed(env)) return;

  throw new Error(
    `External email sending is disabled in ${getEmailRuntimeLabel(env)}. Set ${LIVE_EMAIL_SENDS_FLAG}=true only for an intentional live-send test.`
  );
}
