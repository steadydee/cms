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
};

export function FirstOutreachComposer({
  organizationId,
  contactId,
  recipientEmail,
  recipientLabel,
  defaultSubject,
  defaultBody,
  resendConfigured,
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

      <div>
        <label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#94a3b8]">Template subject</label>
        <input
          name="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]"
        />
      </div>

      <div>
        <label className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#94a3b8]">Template body</label>
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="mt-2 min-h-52 w-full rounded-xl border border-[#d7d2c9] bg-white px-3 py-2.5 text-[14px] text-[#1e293b] outline-none transition focus:border-[#3b82f6]"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={sendIntroEmailAction}
          disabled={!recipientEmail || !resendConfigured}
          className={`rounded-lg px-4 py-2.5 text-[14px] font-medium text-white ${
            recipientEmail && resendConfigured ? "bg-[#0f766e]" : "bg-[#cbd5e1]"
          }`}
        >
          Send with Resend
        </button>

        {mailToHref ? (
          <a
            href={mailToHref}
            className="rounded-lg border border-[#0f766e] px-4 py-2.5 text-[14px] font-medium text-[#0f766e]"
          >
            Open in email app
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-lg border border-[#cbd5e1] px-4 py-2.5 text-[14px] font-medium text-[#94a3b8]"
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
              ? "border border-[#1e293b] text-[#1e293b]"
              : "border border-[#cbd5e1] text-[#94a3b8]"
          }`}
        >
          Log manual send
        </button>
      </div>
    </form>
  );
}
