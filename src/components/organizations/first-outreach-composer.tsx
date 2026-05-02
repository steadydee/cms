"use client";

import { useMemo, useState } from "react";
import { logIntroEmailSentAction, sendIntroEmailAction } from "@/app/(app)/organizations/actions";

type FirstOutreachComposerProps = {
  organizationId: string;
  contactId?: string;
  recipientEmail: string;
  recipientLabel: string;
  defaultSubject: string;
  defaultBody: string;
  resendConfigured: boolean;
  returnTo: string;
};

export function FirstOutreachComposer({
  organizationId,
  contactId,
  recipientEmail,
  recipientLabel,
  defaultSubject,
  defaultBody,
  resendConfigured,
  returnTo,
}: FirstOutreachComposerProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  const mailToHref = useMemo(() => {
    if (!recipientEmail) return null;

    const params = new URLSearchParams({
      subject,
      body,
    });

    return `mailto:${recipientEmail}?${params.toString()}`;
  }, [body, recipientEmail, subject]);

  return (
    <form className="mt-6 space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="contactId" value={contactId || ""} />
      <input type="hidden" name="recipientEmail" value={recipientEmail} />
      <input type="hidden" name="recipientLabel" value={recipientLabel} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--ink-faint)]">Template subject</label>
        <input
          name="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
        />
      </div>

      <div>
        <label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--ink-faint)]">Template body</label>
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-2 min-h-52 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={sendIntroEmailAction}
          disabled={!recipientEmail || !resendConfigured}
          className={`rounded-lg px-4 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)] ${
            recipientEmail && resendConfigured ? "bg-[var(--accent)]" : "bg-[var(--line)]"
          }`}
        >
          Send with Resend
        </button>

        {mailToHref ? (
          <a
            href={mailToHref}
            className="rounded-lg border border-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-[var(--accent)]"
          >
            Open in email app
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-lg border border-[var(--line)] px-4 py-2.5 text-[14px] font-medium text-[var(--ink-faint)]"
          >
            Open in email app
          </button>
        )}

        <button
          type="submit"
          formAction={logIntroEmailSentAction}
          disabled={!recipientEmail}
          className={`rounded-lg px-4 py-2.5 text-[14px] font-medium ${
            recipientEmail
              ? "border border-[var(--ink)] text-[var(--ink)]"
              : "border border-[var(--line)] text-[var(--ink-faint)]"
          }`}
        >
          Log manual send
        </button>
      </div>
    </form>
  );
}
