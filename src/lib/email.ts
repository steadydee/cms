type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

type ResendSendResponse = {
  id?: string;
  error?: {
    message?: string;
  };
};

export function getEmailDeliveryStatus() {
  const apiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const fromConfigured = Boolean(process.env.OW_PARTNERS_EMAIL_FROM?.trim());
  const replyToConfigured = Boolean(process.env.OW_PARTNERS_EMAIL_REPLY_TO?.trim());

  return {
    apiKeyConfigured,
    fromConfigured,
    replyToConfigured,
    resendConfigured: apiKeyConfigured && fromConfigured,
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to send email`);
  }

  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToSimpleHtml(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export async function sendEmailWithResend(input: SendEmailInput) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("OW_PARTNERS_EMAIL_FROM");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: textToSimpleHtml(input.text),
      replyTo: input.replyTo?.trim() || process.env.OW_PARTNERS_EMAIL_REPLY_TO?.trim() || undefined,
    }),
    cache: "no-store",
  });

  const payload = await response.json() as ResendSendResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || "Resend email send failed");
  }

  if (!payload.id) {
    throw new Error("Resend did not return a message id");
  }

  return payload.id;
}
