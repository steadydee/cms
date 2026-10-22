"use client";
import { useState, useTransition } from "react";
import { Save, Pause } from "lucide-react";
import { saveDailyOutreachSetupAction } from "@/app/(app)/setup/actions";

type Policy = { enabled: boolean; agentId: string; credentialId: string; templateId: string;
  attachmentName: string; attachmentSha256: string; businessMailbox: string; personalMailbox: string;
  startsAt: string; expiresAt: string };
export function DailyOutreachPolicyForm({ policy, templates }: { policy: Policy | null; templates: { id: string; name: string }[] }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function submit(form: FormData) {
    start(async () => { const result = await saveDailyOutreachSetupAction(form); setMessage(result.ok ? "Outreach policy saved." : result.error || "Unable to save."); });
  }
  const fields = [
    ["agentId", "Worker ID", policy?.agentId || ""], ["credentialId", "Credential ID", policy?.credentialId || ""],
    ["businessMailbox", "Business Gmail", policy?.businessMailbox || "dennis@owlswatch.com"],
    ["personalMailbox", "Personal Gmail", policy?.personalMailbox || "dennis.t.bailey@gmail.com"],
    ["attachmentName", "Approved PDF", policy?.attachmentName || "Precios 2027 Operadores.pdf"],
    ["attachmentSha256", "PDF SHA-256", policy?.attachmentSha256 || "4af93cd04ce8e47cc97d3d9afc6f8a1867c4d81136b303094777593431c087f1"],
  ];
  return <section className="border-y border-[var(--line)] py-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-xl font-semibold">Daily birding outreach</h2>
      <span>{policy?.enabled ? "Enabled" : "Paused"}</span>
    </div>
    <dl className="my-4 grid gap-2 text-sm sm:grid-cols-3"><div><dt>Schedule</dt><dd>Weekdays, 09:00 Bogota</dd></div><div><dt>Daily maximum</dt><dd>One first-contact email</dd></div><div><dt>Sender</dt><dd>info@owlswatch.com</dd></div></dl>
    <form key={policy?.enabled ? "enabled" : "paused"} action={submit} className="grid gap-4 sm:grid-cols-2">
      {fields.map(([name,label,value]) => <label key={name} className="min-w-0 text-sm">{label}<input name={name} defaultValue={value} required className="mt-1 w-full min-w-0 rounded border border-[var(--line)] bg-[var(--card)] p-2" /></label>)}
      <label className="text-sm">Approved template<select name="templateId" defaultValue={policy?.templateId || "cmpy81om60000i80475mfadex"} className="mt-1 w-full rounded border border-[var(--line)] bg-[var(--card)] p-2">{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="flex items-center gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={policy?.enabled || false} />Approved for automatic sending</label>
      <label className="text-sm">Start date<input type="date" name="startsAt" required defaultValue={policy?.startsAt.slice(0,10) || ""} className="mt-1 w-full rounded border border-[var(--line)] bg-[var(--card)] p-2" /></label>
      <label className="text-sm">Expiry date<input type="date" name="expiresAt" required defaultValue={policy?.expiresAt.slice(0,10) || ""} className="mt-1 w-full rounded border border-[var(--line)] bg-[var(--card)] p-2" /></label>
      <div className="flex items-center gap-4 sm:col-span-2"><button disabled={pending} className="inline-flex items-center gap-2 rounded border px-3 py-2"><Save size={16} />Save policy</button><span role="status" className="text-sm">{message}</span></div>
    </form>
    {policy?.enabled && <form action={submit} className="mt-3"><input type="hidden" name="action" value="pause" /><button disabled={pending} className="inline-flex items-center gap-2 rounded border px-3 py-2"><Pause size={16} />Pause outreach</button></form>}
  </section>;
}
