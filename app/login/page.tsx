"use client";

import { useState } from "react";
import { LogoMark } from "@/components/HiringBackdrop";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    // Full page load, not router.push: the client router may still hold a pre-login copy of "/"
    // (a cached redirect back here), which made a correct password look like it failed.
    if (res.ok) window.location.assign("/");
    else setError("That password didn't work.");
  }

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 text-center">
        <LogoMark className="mx-auto h-12 w-12" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Kargo Hire</h1>
          <p className="mt-1 text-sm text-muted">Founder access only. Candidate data is private.</p>
        </div>
        <input
          type="password"
          className="input text-center"
          placeholder="Dashboard password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button className="btn-primary w-full" disabled={busy || !password}>
          {busy ? "Checking…" : "Enter"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
