"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { signIn } from "@/lib/session";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    signIn(email || "demo@promptiq.dev");
    setTimeout(() => router.push("/dashboard"), 550);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left: editorial panel */}
      <aside className="grain relative hidden flex-col justify-between border-r border-line bg-paper-2 p-12 lg:flex">
        <Logo />
        <div className="max-w-[30rem]">
          <p className="eyebrow">From this week&rsquo;s cohort</p>
          <blockquote className="font-display mt-6 text-[2.3rem] leading-[1.1] tracking-[-0.02em]">
            &ldquo;I thought I was good at this. My first score was 61. The feedback told me
            <span className="italic text-rust"> exactly </span>
            why.&rdquo;
          </blockquote>
          <p className="mt-6 text-sm text-ink-2">
            Sharwari Kathole <span className="text-mute">— Operations lead, Northwind Legal · Level 14</span>
          </p>
        </div>
        <div className="flex gap-10 border-t border-line-2 pt-6 font-mono text-[0.72rem] text-ink-2">
          <span>14,203 tasks scored this week</span>
          <span>Median efficiency 71</span>
        </div>
      </aside>

      {/* Right: form */}
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <div className="lg:invisible"><Logo /></div>
          <Link href="/" className="text-sm text-mute hover:text-ink">← Back</Link>
        </div>

        <div className="mx-auto flex w-full max-w-[24rem] flex-1 flex-col justify-center py-16">
          <div className="flex gap-6 border-b border-line text-sm">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`-mb-px border-b-2 pb-3 transition-colors ${mode === m ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink-2"}`}
              >
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>

          <h1 className="font-display mt-10 text-[2.4rem] leading-none tracking-[-0.025em]">
            {mode === "login" ? "Welcome back." : "Let’s find your baseline."}
          </h1>
          <p className="mt-3 text-[0.95rem] text-ink-2">
            {mode === "login" ? "Your streak is waiting. Twelve days and counting." : "Your first task takes about six minutes."}
          </p>

          <form onSubmit={submit} className="mt-10 space-y-6">
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-between">
              {mode === "login" ? "Continue to dashboard" : "Create account"}
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={1.75} />}
            </button>
          </form>

          <p className="mt-8 border-t border-line pt-5 font-mono text-[0.7rem] leading-relaxed text-mute">
            Demo build — any email and password will work. Nothing leaves your browser.
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label, type, value, onChange, placeholder,
}: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 block w-full border-0 border-b border-line-2 bg-transparent px-0 py-2.5 text-[1.02rem] outline-none transition-colors placeholder:text-[#B8AD9C] focus:border-ink"
      />
    </label>
  );
}
