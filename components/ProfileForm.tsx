"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ name, org }: { name: string; org: string | null }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [o, setO] = useState(org ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n, org: o || null }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? "Saved." : data.error ?? "Could not save");
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="mt-10 space-y-5">
      <p className="eyebrow">Edit profile</p>
      {[["Name", n, setN, 80], ["Organisation", o, setO, 80]].map(([label, value, set, max]) => (
        <label key={label as string} className="block">
          <span className="text-[0.85rem] text-ink-2">{label as string}</span>
          <input
            value={value as string}
            maxLength={max as number}
            onChange={(e) => (set as (v: string) => void)(e.target.value)}
            className="mt-1 block w-full border-0 border-b border-line-2 bg-transparent py-2 outline-none focus:border-ink"
          />
        </label>
      ))}
      <div className="flex items-center gap-4">
        <button disabled={busy} className="btn btn-primary !py-2 !text-[0.85rem]">{busy ? "Saving…" : "Save"}</button>
        {msg && <span className="text-[0.85rem] text-ink-2">{msg}</span>}
      </div>
    </form>
  );
}
