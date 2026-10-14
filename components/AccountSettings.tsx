"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const input = "mt-1 block w-full border-0 border-b border-line-2 bg-transparent py-2 outline-none focus:border-ink";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
}

export function AccountSettings({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [delPw, setDelPw] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [delMsg, setDelMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPwMsg(null);
    try {
      await send("/api/me/password", "POST", { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setPwMsg("Password changed. Other devices have been signed out.");
    } catch (err) {
      setPwMsg((err as Error).message);
    }
    setBusy(false);
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setDelMsg(null);
    try {
      await send("/api/me", "DELETE", { password: delPw });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setDelMsg((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 space-y-10">
      <div>
        <p className="eyebrow">Your data</p>
        <p className="mt-2 text-[0.85rem] text-ink-2">Download everything PromptIQ stores about you: profile, attempts, certificates and lab runs.</p>
        <a href="/api/me/export" className="mt-3 inline-block text-[0.85rem] underline underline-offset-4 hover:text-ink">Download my data (JSON)</a>
      </div>

      {isDemo ? (
        <p className="text-[0.85rem] text-mute">Password and deletion are disabled on the shared demo account.</p>
      ) : (
        <>
          <form onSubmit={changePassword} className="space-y-5">
            <p className="eyebrow">Change password</p>
            <label className="block">
              <span className="text-[0.85rem] text-ink-2">Current password</span>
              <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} required />
            </label>
            <label className="block">
              <span className="text-[0.85rem] text-ink-2">New password (8+ characters)</span>
              <input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={input} required />
            </label>
            <div className="flex items-center gap-4">
              <button disabled={busy} className="btn btn-primary !py-2 !text-[0.85rem]">Change password</button>
              {pwMsg && <span className="text-[0.85rem] text-ink-2">{pwMsg}</span>}
            </div>
          </form>

          <form onSubmit={deleteAccount} className="space-y-4">
            <p className="eyebrow !text-rust">Delete account</p>
            <p className="text-[0.85rem] text-ink-2">
              Permanently removes your account, attempts, lab runs and certificates. Certificates you shared will stop verifying. This cannot be undone.
            </p>
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)} className="text-[0.85rem] text-rust underline underline-offset-4">
                I want to delete my account
              </button>
            ) : (
              <>
                <label className="block">
                  <span className="text-[0.85rem] text-ink-2">Confirm with your password</span>
                  <input type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} className={input} required />
                </label>
                <div className="flex items-center gap-4">
                  <button disabled={busy} className="btn btn-rust !py-2 !text-[0.85rem]">Delete permanently</button>
                  <button type="button" onClick={() => { setConfirming(false); setDelPw(""); }} className="text-[0.85rem] text-mute underline underline-offset-4">Cancel</button>
                  {delMsg && <span className="text-[0.85rem] text-rust">{delMsg}</span>}
                </div>
              </>
            )}
          </form>
        </>
      )}
    </div>
  );
}
