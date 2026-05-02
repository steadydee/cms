"use client";

import { useState, useTransition } from "react";
import { Edit3, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveEmailTemplateSetupAction } from "@/app/(app)/setup/actions";

type EmailTemplateCardProps = {
  template: {
    id: string;
    name: string;
    subject: string;
    body: string;
  };
};

type SaveState = {
  kind: "idle" | "success" | "error";
  message?: string;
};

const inputClassName =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";

function StatusNotice({ state }: { state: SaveState }) {
  if (state.kind === "idle" || !state.message) return null;

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[12px] ${
        state.kind === "error"
          ? "border-[var(--destructive-soft)] bg-[var(--destructive-soft)] text-[var(--destructive)]"
          : "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent-deep)]"
      }`}
    >
      {state.message}
    </div>
  );
}

export function EmailTemplateCard({ template }: EmailTemplateCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  function resetForm() {
    setSubject(template.subject);
    setBody(template.body);
    setSaveState({ kind: "idle" });
    setIsEditing(false);
  }

  async function runSave(formData: FormData) {
    startTransition(async () => {
      const result = await saveEmailTemplateSetupAction(formData);
      if (!result.ok) {
        setSaveState({ kind: "error", message: result.error || "Template save failed." });
        return;
      }

      setSaveState({ kind: "success", message: "Template saved." });
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--ink)]">{template.name}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            Placeholders: {"{company}"}, {"{name}"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isEditing) {
              resetForm();
              return;
            }

            setSaveState({ kind: "idle" });
            setIsEditing(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-[12px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--card)]"
        >
          {isEditing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          {isEditing ? "Close" : "Edit"}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <StatusNotice state={saveState} />

        {isEditing ? (
          <form
            action={async (formData) => {
              await runSave(formData);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="templateId" value={template.id} />
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Subject</label>
              <input
                name="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className={`${inputClassName} mt-2`}
                disabled={isPending}
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Body</label>
              <textarea
                name="body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className={`${inputClassName} mt-2 min-h-[180px] resize-y`}
                disabled={isPending}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-contrast)] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isPending ? "Saving..." : "Save template"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isPending}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-[12px] font-medium text-[var(--ink-soft)]">{subject}</p>
            <p className="line-clamp-5 text-[12px] leading-relaxed text-[var(--ink-soft)] whitespace-pre-wrap">{body}</p>
          </>
        )}
      </div>
    </div>
  );
}
