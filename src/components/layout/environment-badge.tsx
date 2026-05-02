import { cn } from "@/lib/utils";

const ENV_META: Record<string, { label: string; className: string }> = {
  production: {
    label: "Production",
    className: "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]",
  },
  test: {
    label: "Test",
    className: "border-[var(--warm-soft)] bg-[var(--warm-soft)] text-[var(--warm)]",
  },
  preview: {
    label: "Preview",
    className: "border-[var(--line)] bg-[var(--card)] text-[var(--ink-soft)]",
  },
  development: {
    label: "Local",
    className: "border-[var(--line)] bg-[var(--line-soft)] text-[var(--ink-soft)]",
  },
};

export function getEnvironmentName() {
  return (process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "development").trim().toLowerCase();
}

export function EnvironmentBadge({
  environment,
  className,
}: {
  environment: string;
  className?: string;
}) {
  if (environment === "production") return null;

  const meta = ENV_META[environment] ?? {
    label: environment.replace(/[_-]+/g, " "),
    className: "border-[var(--line)] bg-[var(--card)] text-[var(--ink-soft)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
