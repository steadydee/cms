"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { FlashMessage } from "@/lib/flash";

const FLASH_COOKIE = "ow_partners_flash";

export function FlashBanner({ message }: { message: FlashMessage }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`mx-6 mt-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-[14px] shadow-[var(--shadow)] ${
        message.type === "success"
          ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--destructive-soft)] bg-[var(--destructive-soft)] text-[var(--destructive)]"
      }`}
    >
      <p>{message.text}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="rounded-md p-1 opacity-70 transition hover:bg-[var(--card)]/60 hover:opacity-100"
        aria-label="Dismiss message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
