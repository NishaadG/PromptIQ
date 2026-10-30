type Pes = { components: { q: number; a: number; t: number; l: number; c: number }; linear: number; gated: number };

const PARTS = [
  ["q", "Quality"], ["a", "Accuracy"], ["t", "Tokens"], ["l", "Latency"], ["c", "Cost"],
] as const;

/** Prompt Efficiency Score: the success-gated score up front, its five components underneath. */
export function PesBreakdown({ pes }: { pes: Pes }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-6 px-6 py-5">
      <div title={`Linear PES (Eq. 1): ${pes.linear}`}>
        <div className="eyebrow !text-[0.6rem]">Prompt efficiency</div>
        <div className="mt-2 font-mono text-[1.6rem] leading-none tabular">{pes.gated}</div>
        <div className="mt-2 text-[0.72rem] text-mute">success-gated PES</div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {PARTS.map(([k, label]) => (
          <div key={k}>
            <div className="h-10 w-full bg-line relative">
              <div className={`bar absolute inset-x-0 bottom-0 ${k === "a" ? "bg-olive" : "bg-ink"}`} style={{ height: `${Math.round(pes.components[k] * 100)}%` }} />
            </div>
            <div className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-mute">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
