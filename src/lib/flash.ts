import "server-only";

import { cookies } from "next/headers";

const FLASH_COOKIE = "ow_partners_flash";

export type FlashMessage = {
  type: "success" | "error";
  text: string;
};

export async function setFlashMessage(message: FlashMessage) {
  const store = await cookies();
  store.set(
    FLASH_COOKIE,
    JSON.stringify(message),
    {
      sameSite: "lax",
      path: "/",
      maxAge: 30,
    }
  );
}

export async function getFlashMessage(): Promise<FlashMessage | null> {
  const store = await cookies();
  const raw = store.get(FLASH_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FlashMessage;
    if (
      parsed
      && (parsed.type === "success" || parsed.type === "error")
      && typeof parsed.text === "string"
      && parsed.text.trim()
    ) {
      return parsed;
    }
  } catch {}

  return null;
}
