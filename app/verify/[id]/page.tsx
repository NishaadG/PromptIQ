import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldAlert, Clock, Ban } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getDb } from "@/lib/server/db";
import { verifyCredential } from "@/lib/server/services/certification";

export const metadata: Metadata = { title: "Verify a PromptIQ certificate" };

const STATUS = {
  valid: { label: "Verified", note: "Signature checks out and the certificate is current.", Icon: BadgeCheck, tone: "text-olive border-olive" },
  expired: { label: "Expired", note: "Genuine, but past its expiry date — the holder should recertify.", Icon: Clock, tone: "text-ink-2 border-line-2" },
  revoked: { label: "Revoked", note: "This certificate was revoked by PromptIQ.", Icon: Ban, tone: "text-rust border-rust" },
  tampered: { label: "Invalid", note: "The record does not match its signature. Do not trust it.", Icon: ShieldAlert, tone: "text-rust border-rust" },
} as const;

export default async function VerifyPage(props: PageProps<"/verify/[id]">) {
  const { id } = await props.params;
  const r = await verifyCredential(await getDb(), decodeURIComponent(id));
  return (
    <div className="min-h-screen px-6 py-8 sm:px-12">
      <Logo />
      <main className="mx-auto max-w-xl py-16">
        <p className="eyebrow">Certificate verification</p>
        {r.status === "not_found" ? (
          <>
            <h1 className="font-display mt-4 text-[2.4rem] leading-none tracking-[-0.025em]">No such certificate.</h1>
            <p className="mt-4 text-ink-2">Check the ID (<span className="font-mono">{decodeURIComponent(id)}</span>) — IDs look like PIQ-SUM-2026-1A2B3C4D.</p>
          </>
        ) : (
          (() => {
            const s = STATUS[r.status];
            const c = r.credential;
            return (
              <div className="grain mt-6 border border-ink bg-card">
                <div className={`flex items-center gap-3 border-b px-6 py-4 ${s.tone}`}>
                  <s.Icon size={20} strokeWidth={1.75} />
                  <div>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[0.85rem] text-ink-2">{s.note}</div>
                  </div>
                </div>
                <div className="px-6 py-8">
                  <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-rust">Certified · {c.level}</div>
                  <div className="font-display mt-4 text-[2.2rem] leading-tight">{c.track}</div>
                  <div className="mt-2 text-ink-2">awarded to <span className="text-ink">{c.holder}</span> · average score {c.score}</div>
                  <dl className="mt-8 border-t border-line text-[0.88rem]">
                    {[["Certificate ID", c.id], ["Issued", new Date(c.issuedAt).toLocaleDateString("en-GB")], ["Expires", new Date(c.expiresAt).toLocaleDateString("en-GB")], ["Signing key", c.keyId]].map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-3 border-b border-line py-3">
                        <dt className="text-ink-2">{k}</dt><span className="leader" /><dd className="font-mono text-[0.8rem]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            );
          })()
        )}
        <p className="mt-8 font-mono text-[0.7rem] leading-relaxed text-mute">
          Certificates are Ed25519-signed. Machine check: <span className="text-ink-2">GET /api/credentials/&lt;id&gt;/verify</span> · public key at <span className="text-ink-2">/api/credentials/public-key</span>.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-mute hover:text-ink">← PromptIQ</Link>
      </main>
    </div>
  );
}
