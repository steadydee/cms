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
  "w-full rounded-lg border border-[#e8e0d4] bg-white px-3 py-2 text-[13px] text-[#2c2416] outline-none transition focus:border-[#3d6b4f]";

function StatusNotice({ state }: { state: SaveState }) {
  if (state.kind === "idle" || !state.message) return null;

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[12px] ${
        state.kind === "error"
          ? "border-[#f2c8c3] bg-[#fdf0ee] text-[#a03f35]"
          : "border-[#d3e3d8] bg-[#edf5ef] text-[#305340]"
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
    <div className="rounded-xl border border-[#ebe3d8] bg-[#fffdfa] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[#2c2416]">{template.name}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#9a8e7a]">
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
          className="inline-flex items-center gap-2 rounded-lg border border-[#ddd2c4] px-3 py-2 text-[12px] font-medium text-[#6d614d] transition hover:bg-white"
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
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Subject</label>
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
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7e6a]">Body</label>
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
                className="inline-flex items-center gap-2 rounded-lg bg-[#3d6b4f] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isPending ? "Saving..." : "Save template"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={isPending}
                className="rounded-lg border border-[#ddd2c4] px-4 py-2 text-[13px] font-medium text-[#6d614d] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-[12px] font-medium text-[#6d614d]">{subject}</p>
            <p className="line-clamp-5 text-[12px] leading-relaxed text-[#8c7e6a] whitespace-pre-wrap">{body}</p>
          </>
        )}
      </div>
    </div>
  );
}
