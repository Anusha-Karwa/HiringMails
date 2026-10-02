"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Role = "PM" | "SPM";
type Item = { key: string; file: File; status: "queued" | "working" | "done" | "error"; message?: string; id?: string };

const ACCEPT = ".docx,.pdf,.txt,.md";

export function UploadForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, status: "queued" as const }));
    setItems((cur) => [...cur.filter((i) => i.status !== "done"), ...next]);
  };

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function run() {
    if (!role) return;
    setBusy(true);
    // One request per CV keeps each serverless call well inside its time limit.
    for (const item of items.filter((i) => i.status === "queued" || i.status === "error")) {
      patch(item.key, { status: "working", message: "Redacting and scoring…" });
      const fd = new FormData();
      fd.set("file", item.file);
      fd.set("role", role);
      try {
        const res = await fetch("/api/candidates", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string | null; duplicate?: boolean };
        if (res.status === 504) {
          patch(item.key, { status: "error", message: "Took too long. Upload it again: it won't be duplicated." });
        } else if (!res.ok) patch(item.key, { status: "error", message: data.error ?? `Failed (${res.status})` });
        else if (data.error) patch(item.key, { status: "error", message: data.error, id: data.id });
        else patch(item.key, { status: "done", message: data.duplicate ? "Already here, updated" : "Scored", id: data.id });
      } catch {
        patch(item.key, { status: "error", message: "Network error" });
      }
    }
    setBusy(false);
    router.refresh();
  }

  const pending = items.filter((i) => i.status === "queued" || i.status === "error").length;
  const done = items.filter((i) => i.status === "done").length;

  return (
    <div className="card space-y-5">
      <div>
        <span className="label">Role applied for</span>
        <div className="grid grid-cols-2 gap-2">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                role === r
                  ? "border-brand-400 bg-brand-50 ring-4 ring-brand-100"
                  : "border-line bg-paper hover:border-brand-400"
              }`}
            >
              <span className="block font-display text-lg font-semibold text-ink">{r}</span>
              <span className="text-xs text-muted">{r === "PM" ? "Product Manager · 2–4 yrs" : "Senior Product Manager · 5–8 yrs"}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-brand-400 bg-brand-50" : "border-line bg-paper hover:border-brand-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">Drop CVs here, or click to choose</p>
        <p className="mt-1 text-xs text-faint">.docx, .pdf or .txt · up to 5 MB each</p>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 bg-paper px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate text-ink">{i.file.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                {i.status === "working" && <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />}
                <span
                  className={
                    i.status === "done" ? "text-brand-700" : i.status === "error" ? "text-red-600" : "text-muted"
                  }
                >
                  {i.message ?? "Queued"}
                </span>
                {i.id && (
                  <Link href={`/c/${i.id}`} className="text-brand-700 underline-offset-2 hover:underline">
                    open
                  </Link>
                )}
                {i.status === "queued" && !busy && (
                  <button
                    type="button"
                    onClick={() => setItems((cur) => cur.filter((x) => x.key !== i.key))}
                    className="text-faint hover:text-ink"
                    aria-label={`Remove ${i.file.name}`}
                  >
                    ✕
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint">
          {!role ? "Choose PM or SPM first." : pending ? `${pending} CV${pending > 1 ? "s" : ""} ready to score as ${role}.` : done ? `${done} scored.` : "Add CVs to start."}
        </p>
        <div className="flex gap-2">
          {done > 0 && !busy && (
            // Plain link (full load) so the ranking can't come from a pre-upload router cache.
            <a href="/" className="btn-secondary">
              View ranking
            </a>
          )}
          <button type="button" className="btn-primary" disabled={!role || !pending || busy} onClick={run}>
            {busy ? "Scoring…" : "Score CVs"}
          </button>
        </div>
      </div>
    </div>
  );
}
