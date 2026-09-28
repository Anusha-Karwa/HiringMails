"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Decision, EmailDraft } from "@/lib/types";

const FIRST_NAME = "{{first_name}}";

type Slot = { local: string; minutes: number; mode: "in_person" | "video"; link: string; google: string };

async function call(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? `Request failed (${res.status})`;
}

function prettySlot(local: string): string {
  const d = new Date(`${local}:00+05:30`);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * The one place Arjun acts: Advance or Pass, pick a slot, Send. Only after a decision is an email
 * drafted; nothing leaves until he clicks Send.
 */
export function DecisionPanel(props: {
  id: string;
  decision: Decision;
  draft: EmailDraft | null;
  sentAt: string | null;
  sentTo: string | null;
  recipient: string | null;
  founderCopyTo: string | null;
  isTestRecipient: boolean;
  emailEnabled: boolean;
  firstName: string;
  slot: Slot | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState(props.draft?.subject ?? "");
  const [body, setBody] = useState(props.draft?.body ?? "");
  const [editingSlot, setEditingSlot] = useState(false);
  const [at, setAt] = useState(props.slot?.local ?? "");
  const [minutes, setMinutes] = useState(props.slot?.minutes ?? 45);
  const [mode, setMode] = useState<Slot["mode"]>(props.slot?.mode ?? "in_person");
  const [link, setLink] = useState(props.slot?.link ?? "");

  useEffect(() => {
    setSubject(props.draft?.subject ?? "");
    setBody(props.draft?.body ?? "");
  }, [props.draft?.drafted_at, props.draft?.subject, props.draft?.body]);

  const dirty = props.draft && (subject !== props.draft.subject || body !== props.draft.body);

  async function run(label: string, fn: () => Promise<string | null>, after?: () => void) {
    setBusy(label);
    setError(null);
    const err = await fn();
    setBusy(null);
    if (err) setError(err);
    else {
      after?.();
      router.refresh();
    }
  }

  const api = `/api/candidates/${props.id}`;
  const decide = (d: Decision) => run(d, () => call(`${api}/decision`, "POST", { decision: d }));
  const saveSlot = () => run("slot", () => call(`${api}/interview`, "PUT", { at, minutes, mode, link }), () => setEditingSlot(false));
  const clearSlot = () => run("slot", () => call(`${api}/interview`, "DELETE"));
  const send = () =>
    run("send", async () => {
      if (dirty) {
        const err = await call(`${api}/email`, "PATCH", { subject, body });
        if (err) return err;
      }
      return call(`${api}/send`, "POST");
    });

  const preview = (t: string) => t.split(FIRST_NAME).join(props.firstName);
  const showSlotForm = props.decision === "advance" && (editingSlot || !props.slot);

  const slotBlock = props.decision === "advance" && (
    <div className="space-y-3 rounded-xl bg-paper p-4">
      <p className="text-sm font-semibold">Interview</p>
      {props.slot && !editingSlot ? (
        <>
          <p className="text-sm">
            {prettySlot(props.slot.local)} · {props.slot.minutes} min · {props.slot.mode === "video" ? "Video" : "In person"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={props.slot.google} target="_blank" rel="noreferrer" className="link">
              Add to Google Calendar
            </a>
            <a href={`${api}/invite.ics`} className="link">
              .ics
            </a>
            <button type="button" className="link" onClick={() => setEditingSlot(true)}>
              Change
            </button>
            <button type="button" className="text-faint hover:text-ink" onClick={clearSlot} disabled={!!busy}>
              Remove
            </button>
          </div>
          <p className="text-xs text-faint">Already in your hiring calendar, with reminders a day and 30 min before.</p>
        </>
      ) : showSlotForm ? (
        <>
          <input type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Interview date and time (IST)" />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Length">
              {[30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as Slot["mode"])} aria-label="Format">
              <option value="in_person">In person</option>
              <option value="video">Video call</option>
            </select>
          </div>
          {mode === "video" && (
            <input className="input" placeholder="Meeting link (https://…)" value={link} onChange={(e) => setLink(e.target.value)} />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1 !py-2" disabled={!at || !!busy} onClick={saveSlot}>
              {busy === "slot" ? "Saving…" : "Book slot"}
            </button>
            {editingSlot && (
              <button type="button" className="btn-ghost !py-2" onClick={() => setEditingSlot(false)}>
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-faint">Mumbai time. Optional: skip it and the email asks the candidate for times.</p>
        </>
      ) : null}
    </div>
  );

  if (props.sentAt) {
    return (
      <section className="card space-y-4">
        <h2 className="font-semibold">Done</h2>
        <p className="text-sm text-muted">
          {props.decision === "advance" ? "Invite" : "Rejection"} sent to <span className="font-semibold text-ink">{props.sentTo}</span> on{" "}
          {new Date(props.sentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.
        </p>
        {slotBlock}
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">Your call</h2>
        <p className="mt-0.5 text-xs text-faint">The email is drafted after you decide. Nothing is sent until you press Send.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => decide("advance")}
          className={`btn ${props.decision === "advance" ? "bg-brand-500 text-ink" : "border border-brand-300 bg-white text-brand-800 hover:bg-brand-50"}`}
        >
          {busy === "advance" ? "Drafting…" : "Advance"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => decide("pass")}
          className={`btn ${props.decision === "pass" ? "bg-ink text-white" : "border border-line bg-white text-ink hover:bg-gray-50"}`}
        >
          {busy === "pass" ? "Drafting…" : "Pass"}
        </button>
      </div>

      {slotBlock}

      {props.draft && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{props.draft.kind === "invite" ? "Invite email" : "Rejection email"}</p>
            <button type="button" className="text-xs text-faint hover:text-ink" onClick={() => decide("pending")} disabled={!!busy}>
              Undo
            </button>
          </div>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
          <textarea className="input min-h-[13rem] resize-y leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Email body" />
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Preview as {props.firstName} will see it</summary>
            <div className="mt-2 whitespace-pre-wrap rounded-xl bg-paper p-3">
              <p className="font-semibold text-ink">{preview(subject)}</p>
              <p className="mt-2">{preview(body)}</p>
            </div>
          </details>
          <p className="text-xs text-faint">
            To {props.recipient ?? "no email on CV"}
            {props.isTestRecipient && " (test inbox)"}
            {props.draft.kind === "invite" && props.slot && `, with a calendar invite${props.founderCopyTo ? `; a copy goes to your calendar` : ""}`}
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!!busy || !props.emailEnabled || !props.recipient}
            onClick={send}
            title={!props.emailEnabled ? "Add RESEND_API_KEY to enable sending" : undefined}
          >
            {busy === "send" ? "Sending…" : "Send"}
          </button>
          {!props.emailEnabled && <p className="text-xs text-amber-800">Sending is off until RESEND_API_KEY is set.</p>}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
