import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { leaderboard } from "@/lib/mock-data";
import { PageHeader } from "@/components/PageHeader";

export default function Leaderboard() {
  const [first, second, third, ...rest] = leaderboard;

  return (
    <div className="rise">
      <PageHeader eyebrow="Leaderboard · Season 3, week 38" title={<>The <span className="italic">standings.</span></>}>
        <div className="flex border border-line text-sm">
          {["This week", "Season", "All time"].map((t, i) => (
            <span key={t} className={`px-4 py-2 ${i === 1 ? "bg-ink text-paper" : "text-ink-2"} ${i > 0 ? "border-l border-line" : ""}`}>{t}</span>
          ))}
        </div>
      </PageHeader>

      <section className="px-5 py-10 md:px-10">
        {/* Podium — editorial, not medals */}
        <div className="grid border-y border-ink md:grid-cols-[1.4fr_1fr_1fr] md:divide-x md:divide-line">
          {[first, second, third].map((p, i) => (
            <div key={p.rank} className={`px-2 py-8 md:px-8 ${i > 0 ? "border-t border-line md:border-t-0" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className={`font-display italic leading-none ${i === 0 ? "text-[5rem] text-rust" : "text-[3.2rem] text-ink-2"}`}>{p.rank}</span>
                <Delta d={p.delta} />
              </div>
              <div className={`font-display mt-5 leading-tight tracking-[-0.015em] ${i === 0 ? "text-[2rem]" : "text-[1.45rem]"}`}>{p.name}</div>
              <div className="mt-1 text-[0.85rem] text-mute">{p.org}</div>
              <div className="mt-5 flex gap-6 font-mono text-[0.75rem] text-ink-2">
                <span>L{p.level}</span>
                <span className="tabular">{p.tokens.toLocaleString()} tk</span>
                <span>eff {p.efficiency}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Rest */}
        <div className="mt-12">
          <div className="grid grid-cols-[2.5rem_1fr_auto] gap-4 border-b border-ink pb-2 font-mono text-[0.65rem] uppercase tracking-wider text-mute sm:grid-cols-[3rem_1fr_4rem_4rem_7rem_2.5rem]">
            <span>#</span><span>Name</span>
            <span className="hidden text-right sm:block">Level</span>
            <span className="hidden text-right sm:block">Eff.</span>
            <span className="text-right">Tokens</span>
            <span className="hidden sm:block" />
          </div>
          {rest.map((p) => (
            <div
              key={p.rank}
              className={`grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-b border-line py-4 sm:grid-cols-[3rem_1fr_4rem_4rem_7rem_2.5rem] ${p.isYou ? "relative bg-rust-soft/60" : ""}`}
            >
              {p.isYou && <span className="absolute inset-y-0 -left-5 w-[3px] bg-rust md:-left-10" />}
              <span className="font-display text-[1.4rem] italic leading-none text-ink-2">{p.rank}</span>
              <div className="flex min-w-0 items-baseline gap-3">
                <span className={`truncate text-[1rem] ${p.isYou ? "font-medium" : ""}`}>{p.name}</span>
                {p.isYou && <span className="font-mono text-[0.62rem] uppercase tracking-wider text-rust">You</span>}
                <span className="hidden truncate text-[0.8rem] text-mute lg:inline">{p.org}</span>
                <span className="leader hidden sm:block" />
              </div>
              <span className="hidden text-right font-mono text-sm sm:block">L{p.level}</span>
              <span className="hidden text-right font-mono text-sm text-ink-2 sm:block">{p.efficiency}</span>
              <span className="text-right font-mono text-sm tabular">{p.tokens.toLocaleString()}</span>
              <span className="hidden justify-end sm:flex"><Delta d={p.delta} /></span>
            </div>
          ))}
          <p className="mt-6 font-mono text-[0.7rem] text-mute">
            You climbed 4 places this week. 11,820 tokens to overtake Daniel Kim.
          </p>
        </div>
      </section>
    </div>
  );
}

function Delta({ d }: { d: number }) {
  if (d === 0) return <Minus size={12} className="text-mute" />;
  const Up = d > 0;
  return (
    <span className={`flex items-center gap-0.5 font-mono text-[0.7rem] ${Up ? "text-olive" : "text-rust"}`}>
      {Up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(d)}
    </span>
  );
}
