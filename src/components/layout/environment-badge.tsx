import { cn } from "@/lib/utils";

const ENV_META: Record<string, { label: string; className: string }> = {
  production: {
    label: "Production",
    className: "border-[#cfe5db] bg-[#eef8f3] text-[#0f766e]",
  },
  test: {
    label: "Test",
    className: "border-[#f0d9c9] bg-[#fff4eb] text-[#c4713b]",
  },
  preview: {
    label: "Preview",
    className: "border-[#d8dee9] bg-[#f8fafc] text-[#475569]",
  },
  development: {
    label: "Local",
    className: "border-[#ddd6cc] bg-[#f8f5f0] text-[#6b5d4a]",
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
  const meta = ENV_META[environment] ?? {
    label: environment.replace(/[_-]+/g, " "),
    className: "border-[#d8dee9] bg-[#f8fafc] text-[#475569]",
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
