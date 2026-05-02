"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type Theme = "day" | "night";

const STORAGE_KEY = "ow-crm-theme";

function applyTheme(theme: Theme) {
  if (theme === "night") {
    document.documentElement.setAttribute("data-theme", "night");
    document.body.setAttribute("data-theme", "night");
  } else {
    document.documentElement.removeAttribute("data-theme");
    document.body.removeAttribute("data-theme");
  }

  window.dispatchEvent(new Event("ow-crm-theme-change"));
}

function getClientTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "night" ||
    document.documentElement.getAttribute("data-theme") === "night" ||
    document.body.getAttribute("data-theme") === "night"
    ? "night"
    : "day";
}

function getServerTheme(): Theme {
  return "day";
}

function subscribeTheme(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("ow-crm-theme-change", listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("ow-crm-theme-change", listener);
  };
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, getClientTheme, getServerTheme);

  useEffect(() => {
    applyTheme(getClientTheme());
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "night" ? "day" : "night";
    localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const isNight = theme === "night";

  return (
    <button
      type="button"
      aria-pressed={isNight}
      onClick={toggleTheme}
      className={
        compact
          ? "inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[12px] font-medium text-[var(--ink-soft)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          : "flex w-full items-center justify-between rounded-2xl border border-sidebar-border bg-sidebar-accent px-3 py-3 text-sidebar-foreground/75 transition hover:text-sidebar-foreground"
      }
    >
      <span className="inline-flex items-center gap-2 text-[13px] font-medium">
        {isNight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        {isNight ? "Night" : "Day"}
      </span>
      <span className="text-[11px] uppercase tracking-[0.16em] opacity-70">Mode</span>
    </button>
  );
}
