"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CandidateActions({ id, runs }: { id: string; runs: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rescore() {
    setBusy("rescore");
    setError(null);
    const res = await fetch(`/api/candidates/${id}/rescore`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) setError(data.error ?? "Re-score failed");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this candidate and their CV text from the dashboard? This can't be undone.")) return;
    setBusy("delete");
    await fetch(`/api/candidates/${id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-2 px-1 text-xs text-faint">
      <span>
        Scored {runs}×{" "}
        <button type="button" className="link font-medium" onClick={rescore} disabled={!!busy} title="Runs the same prompt again and flags any category that moves by 2+">
          {busy === "rescore" ? "re-scoring…" : "re-score"}
        </button>
      </span>
      <button type="button" className="hover:text-red-600" onClick={remove} disabled={!!busy}>
        Delete
      </button>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
