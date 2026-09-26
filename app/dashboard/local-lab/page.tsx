import { Cloud, HardDrive, Info } from "lucide-react";
import { localLab as lab } from "@/lib/mock-data";
import { PageHeader } from "@/components/PageHeader";

export default function LocalLab() {
  return (
    <div className="rise">
      <PageHeader eyebrow="Local Lab" title={<>Same prompt. <span className="italic">Smaller</span> model.</>}>
        <p className="max-w-sm text-[0.92rem] leading-relaxed text-ink-2">
          Good prompts travel. We run your best prompts on a 3B model on your own machine and
          show you where it holds up — and where it doesn&rsquo;t.
        </p>
      </PageHeader>

      <section className="px-5 py-10 md:px-10">
        {/* Task + prompt */}
        <div className="grid gap-6 md:grid-cols-[10rem_1fr]">
          <span className="eyebrow pt-1">Task</span>
          <p className="font-display text-[1.35rem] leading-snug">{lab.task}</p>
          <span className="eyebrow pt-1">Your prompt</span>
          <pre className="whitespace-pre-wrap border border-line bg-card px-5 py-4 font-mono text-[0.82rem] leading-relaxed text-ink-2">{lab.prompt}</pre>
        </div>

        {/* Comparison */}
        <div className="mt-12 grid border border-ink bg-card md:grid-cols-2">
          <Side
            icon={<Cloud size={16} strokeWidth={1.5} />}
            label="Cloud model"
            d={lab.cloud}
          />
          <Side
            icon={<HardDrive size={16} strokeWidth={1.5} />}
            label="Your local model"
            d={lab.local}
            highlight
          />
        </div>

        <div className="mt-6 flex items-start gap-3 border-l-2 border-olive bg-olive-soft/60 px-5 py-4">
          <Info size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-olive" />
          <p className="text-[0.93rem] leading-relaxed text-ink">
            A well-written prompt on a small local model <strong className="font-semibold">matched the cloud model here</strong> —
            identical fields, two quality points apart, at zero marginal cost. The strict output schema and the
            explicit <code className="font-mono text-[0.85em]">null</code> rule did the heavy lifting.
          </p>
        </div>

        {/* History */}
        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="font-display text-[1.7rem] leading-tight tracking-[-0.015em]">Where small models hold up</h2>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-ink-2">
              Across your last four Lab runs. Structured extraction survives the downgrade; multi-step reasoning doesn&rsquo;t — yet.
            </p>
          </div>
          <div>
            <div className="grid grid-cols-[1fr_4rem_4rem] border-b border-ink pb-2 font-mono text-[0.65rem] uppercase tracking-wider text-mute">
              <span>Task type</span><span className="text-right">Cloud</span><span className="text-right">Local</span>
            </div>
            {lab.history.map((h) => {
              const gap = h.cloud - h.local;
              return (
                <div key={h.task} className="border-b border-line py-4">
                  <div className="grid grid-cols-[1fr_4rem_4rem] items-baseline">
                    <span className="text-[0.95rem]">{h.task}</span>
                    <span className="text-right font-mono text-sm tabular text-ink-2">{h.cloud}</span>
                    <span className={`text-right font-mono text-sm tabular ${gap <= 4 ? "text-olive" : gap > 20 ? "text-rust" : ""}`}>{h.local}</span>
                  </div>
                  <div className="relative mt-3 h-[3px] bg-line">
                    <div className="bar absolute inset-y-0 left-0 bg-line-2" style={{ width: `${h.cloud}%` }} />
                    <div className={`bar absolute inset-y-0 left-0 ${gap <= 4 ? "bg-olive" : gap > 20 ? "bg-rust" : "bg-ink"}`} style={{ width: `${h.local}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

type SideData = typeof lab.cloud;

function Side({ icon, label, d, highlight }: { icon: React.ReactNode; label: string; d: SideData; highlight?: boolean }) {
  return (
    <div className={`flex flex-col ${highlight ? "border-t border-ink md:border-t-0 md:border-l" : ""}`}>
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={highlight ? "text-olive" : "text-ink-2"}>{icon}</span>
          <div>
            <div className="text-[0.95rem] font-medium">{label}</div>
            <div className="font-mono text-[0.68rem] text-mute">{d.model} · {d.detail}</div>
          </div>
        </div>
        {highlight && <span className="border border-olive px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-olive">Matched</span>}
      </div>

      <pre className="flex-1 bg-paper px-6 py-5 font-mono text-[0.82rem] leading-relaxed text-ink">{d.output}</pre>

      <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
        <Stat k="Quality" v={`${d.quality}`} />
        <Stat k="Cost" v={d.cost} accent={highlight ? "text-olive" : undefined} />
        <Stat k="Latency" v={d.latency} />
      </dl>
    </div>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="px-6 py-4">
      <dt className="eyebrow !text-[0.6rem]">{k}</dt>
      <dd className={`font-display mt-1 text-[1.9rem] leading-none tabular ${accent ?? ""}`}>{v}</dd>
    </div>
  );
}
