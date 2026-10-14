"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Track = { track: string; total: number; passed: number; eligible: boolean; avgScore: number; level: string; credentialId: string | null };
type Held = { id: string; track: string; level: string; score: number; expiresAt: string; revoked: boolean };

export function Certificates({ tracks, held }: { tracks: Track[]; held: Held[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function issue(track: string) {
    setBusy(track);
    setError(null);
    const res = await fetch("/api/credentials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ track }) });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error ?? "Could not issue certificate");
    router.refresh();
  }

  const active = held.filter((h) => !h.revoked && new Date(h.expiresAt) > new Date());
  return (
    <div>
      <p className="eyebrow">Certificates</p>
      {active.length === 0 && <p className="mt-3 text-[0.92rem] text-ink-2">No certificates yet. Pass every task in a track at 85+ to earn one.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {active.map((c) => (
          <Link key={c.id} href={`/verify/${c.id}`} className="grain block border border-ink bg-card p-6 hover:shadow-[3px_3px_0_#1C1915]">
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-rust">Certified · {c.level}</div>
            <div className="font-display mt-6 text-[1.7rem] leading-tight">{c.track}</div>
            <div className="mt-6 border-t border-line pt-3 font-mono text-[0.65rem] text-mute">{c.id} · verify ↗</div>
          </Link>
        ))}
      </div>
      <p className="eyebrow mt-10">Tracks</p>
      <ul className="mt-2">
        {tracks.map((t) => (
          <li key={t.track} className="flex flex-wrap items-baseline gap-4 border-b border-line py-3 text-[0.92rem]">
            <span className="flex-1">{t.track}</span>
            <span className="font-mono text-[0.72rem] text-mute">{t.passed}/{t.total} passed at 85+</span>
            {t.credentialId ? (
              <span className="font-mono text-[0.72rem] text-olive">Certified</span>
            ) : t.eligible ? (
              <button onClick={() => issue(t.track)} disabled={busy === t.track} className="btn btn-primary !px-3 !py-1.5 !text-[0.78rem]">
                {busy === t.track ? "Issuing…" : "Issue certificate"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-[0.85rem] text-rust">{error}</p>}
    </div>
  );
}
