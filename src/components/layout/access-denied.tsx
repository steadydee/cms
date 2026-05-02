export function AccessDenied({
  title = "Access denied",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-[var(--shadow)]">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
