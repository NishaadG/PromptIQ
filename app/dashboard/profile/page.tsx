import { currentUser, recentActivity } from "@/lib/mock-data";
import { PageHeader } from "@/components/PageHeader";

export default function Profile() {
  const u = currentUser;
  return (
    <div className="rise">
      <PageHeader eyebrow="Profile" title={u.name} />
      <section className="grid gap-12 px-5 py-10 md:px-10 lg:grid-cols-[1fr_1.4fr]">
        <dl className="border-t border-ink">
          {[
            ["Level", `${u.level} — ${u.levelTitle}`],
            ["Token balance", u.tokens.toLocaleString()],
            ["Current streak", `${u.streak} days`],
            ["Average efficiency", "88"],
            ["Tasks completed", "47"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3 border-b border-line py-4">
              <dt className="text-ink-2">{k}</dt>
              <span className="leader" />
              <dd className="font-mono text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="eyebrow">Certificates</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {u.certifiedTracks.map((c) => (
              <div key={c} className="grain border border-ink bg-card p-6">
                <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-rust">Certified · Level I</div>
                <div className="font-display mt-6 text-[1.7rem] leading-tight">{c}</div>
                <div className="mt-6 border-t border-line pt-3 font-mono text-[0.65rem] text-mute">PIQ-{c.slice(0, 3).toUpperCase()}-2026-0913</div>
              </div>
            ))}
          </div>
          <p className="eyebrow mt-12">History</p>
          <ul className="mt-2">
            {recentActivity.map((a) => (
              <li key={a.label} className="flex items-baseline gap-4 border-b border-line py-3 text-[0.92rem]">
                <span className="font-display w-8 text-lg">{a.score}</span>
                <span className="flex-1">{a.label}</span>
                <span className="font-mono text-[0.7rem] text-mute">{a.when}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
