import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Landing() {
  return (
    <div className="overflow-x-hidden">
      <Nav />
      <Hero />
      <HowItWorks />
      <Stats />
      <Closing />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 md:px-10">
        <div className="flex items-center gap-12">
          <Logo />
          <nav className="hidden items-center gap-8 text-[0.88rem] text-ink-2 md:flex">
            <a href="#product" className="hover:text-ink">Product</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#" className="hover:text-ink">Pricing</a>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost border-transparent hidden sm:inline-flex">Log in</Link>
          <Link href="/login?mode=signup" className="btn btn-primary">
            Get started <ArrowRight size={15} strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="product" className="grain border-b border-line">
      <div className="mx-auto grid max-w-[1320px] grid-cols-12 gap-x-6 px-5 pt-14 pb-20 md:px-10 md:pt-24 md:pb-28">
        <div className="col-span-12 lg:col-span-7">
          <p className="eyebrow rise flex items-center gap-3">
            <span className="inline-block h-px w-8 bg-rust" />
            Skills assessment for the AI era
          </p>
          <h1 className="font-display rise mt-8 text-[3.2rem] leading-[0.95] tracking-[-0.035em] sm:text-[4.6rem] lg:text-[5.9rem]" style={{ animationDelay: "60ms" }}>
            Prompting skill,
            <br />
            <span className="italic text-rust">finally</span> measurable.
          </h1>
          <div className="rise mt-10 grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end md:pl-[18%]" style={{ animationDelay: "140ms" }}>
            <p className="max-w-[30rem] text-[1.08rem] leading-relaxed text-ink-2">
              PromptIQ gives you real work — contracts, spreadsheets, support queues — and scores
              how you prompt through it: did the task succeed, how many tokens did it cost, and
              could a smaller model have done it. Pass enough, and you&rsquo;re certified.
            </p>
          </div>
          <div className="rise mt-10 flex flex-wrap items-center gap-5 md:pl-[18%]" style={{ animationDelay: "200ms" }}>
            <Link href="/login?mode=signup" className="btn btn-primary text-[0.95rem]">
              Take your first task <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
            <span className="text-sm text-mute">Six minutes. No card.</span>
          </div>
        </div>

        <div className="col-span-12 mt-16 lg:col-span-5 lg:mt-6">
          <HeroMock />
        </div>
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="rise relative lg:translate-x-8" style={{ animationDelay: "260ms" }}>
      <div className="absolute -top-3 left-6 z-10 bg-paper px-2 eyebrow">Result · Task 041</div>
      <div className="border border-ink bg-card">
        <div className="border-b border-line px-6 pt-7 pb-5">
          <p className="text-[0.8rem] text-mute">Summarize a legal clause for a non-lawyer</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="font-display text-[4.2rem] leading-none tracking-tight">92</div>
              <div className="eyebrow mt-2">Task success</div>
            </div>
            <div className="stamp mb-2 -rotate-8 border-2 border-rust px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-rust" style={{ animationDelay: "900ms" }}>
              +120 tokens
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
          <div className="px-6 py-4">
            <div className="font-mono text-lg tabular">340</div>
            <div className="text-[0.75rem] text-mute">tokens used · budget 600</div>
          </div>
          <div className="px-6 py-4">
            <div className="font-mono text-lg tabular">88<span className="text-mute">/100</span></div>
            <div className="text-[0.75rem] text-mute">efficiency</div>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="eyebrow mb-3">Feedback</div>
          <p className="border-l-2 border-rust pl-3 text-[0.9rem] leading-snug text-ink-2">
            You pasted the full agreement when only ¶3 was needed — that cost ~3× the tokens.
          </p>
        </div>
      </div>
      <div className="ml-auto mr-6 -mt-px w-[62%] border border-t-0 border-line bg-paper-2 px-5 py-3">
        <div className="flex items-center justify-between font-mono text-[0.72rem] text-ink-2">
          <span>Local 3B model</span>
          <span className="text-olive">matched · $0.00</span>
        </div>
      </div>
    </div>
  );
}

const steps = [
  {
    n: "01",
    title: "Get a real task",
    body: "Not trivia. A supplier contract to decode, a CSV to clean, a stakeholder email to rewrite. Each task ships with the context a real job would give you — and a token budget.",
    aside: "“Summarize §9.3 for a small-business owner reading on their phone.”",
  },
  {
    n: "02",
    title: "Prompt it",
    body: "Write the prompt you’d actually send. Iterate if you like — every attempt is logged, and so is every token you spend getting there.",
    aside: "Attempt 2 of 3 · 340 / 600 tokens",
  },
  {
    n: "03",
    title: "See your score — and the bill",
    body: "An evaluator grades the output against a rubric, then we show what it cost and where the waste was. Specific, line-level feedback, not a vibe.",
    aside: "92% success · 88 efficiency · +120",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-b border-line">
      <div className="mx-auto max-w-[1320px] px-5 py-24 md:px-10 md:py-32">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <p className="eyebrow">How it works</p>
            <h2 className="font-display mt-5 text-[2.6rem] leading-[1.02] tracking-[-0.025em] md:text-[3.2rem]">
              Three steps.
              <br />
              <span className="italic text-ink-2">Zero</span> multiple choice.
            </h2>
            <p className="mt-6 max-w-xs text-ink-2">
              Most AI courses test whether you&rsquo;ve heard of chain-of-thought. We test whether you can
              get a clean answer out of a model, cheaply.
            </p>
          </div>

          <ol className="col-span-12 md:col-span-8 md:col-start-5 lg:col-span-7 lg:col-start-6">
            {steps.map((s, i) => (
              <li
                key={s.n}
                className="grid grid-cols-[3.5rem_1fr] gap-x-4 border-t border-line py-10 last:border-b sm:grid-cols-[5rem_1fr]"
                style={{ marginLeft: `${i * 6}%` }}
              >
                <span className="font-display text-[2.4rem] leading-none italic text-rust">{s.n}</span>
                <div>
                  <h3 className="font-display text-[1.6rem] leading-tight tracking-[-0.015em]">{s.title}</h3>
                  <p className="mt-3 max-w-[34rem] leading-relaxed text-ink-2">{s.body}</p>
                  <p className="mt-5 inline-block border border-line bg-card px-3 py-2 font-mono text-[0.75rem] text-ink-2">
                    {s.aside}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto max-w-[1320px] px-5 py-24 md:px-10 md:py-28">
        <p className="eyebrow !text-[#A99C8A]">The gap</p>
        <div className="mt-10 grid grid-cols-12 items-end gap-y-12">
          <div className="col-span-12 sm:col-span-6 lg:col-span-5">
            <div className="font-display text-[7rem] leading-[0.8] tracking-[-0.05em] md:text-[10rem]">88<span className="text-[0.5em] align-top">%</span></div>
            <p className="mt-6 max-w-[18rem] text-[1.05rem] leading-snug text-[#CFC5B6]">of companies now use AI somewhere in the business.</p>
          </div>
          <div className="col-span-12 sm:col-span-6 lg:col-span-4 lg:col-start-7">
            <div className="font-display text-[7rem] leading-[0.8] tracking-[-0.05em] italic text-[#D98A6B] md:text-[10rem]">5<span className="text-[0.5em] align-top not-italic">%</span></div>
            <p className="mt-6 max-w-[18rem] text-[1.05rem] leading-snug text-[#CFC5B6]">see measurable return on it.</p>
          </div>
        </div>
        <div className="mt-20 grid grid-cols-12 gap-6 border-t border-[#3A342D] pt-10">
          <p className="font-display col-span-12 text-[1.7rem] leading-snug tracking-[-0.01em] md:col-span-7 md:text-[2.1rem]">
            The difference isn&rsquo;t the model. It&rsquo;s whether the person using it knows what they&rsquo;re doing — and nobody&rsquo;s been measuring that.
          </p>
          <div className="col-span-12 space-y-3 self-end text-sm text-[#A99C8A] md:col-span-4 md:col-start-9">
            {["Scored on outcome, not vocabulary", "Token cost on every attempt", "Certificates your manager can verify"].map((t) => (
              <div key={t} className="flex items-center gap-3 border-b border-[#3A342D] pb-3">
                <Check size={14} strokeWidth={2} className="text-[#D98A6B]" /> {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="grain border-b border-line">
      <div className="mx-auto grid max-w-[1320px] grid-cols-12 gap-6 px-5 py-24 md:px-10">
        <h2 className="font-display col-span-12 text-[2.6rem] leading-[1] tracking-[-0.03em] md:col-span-8 md:text-[4rem]">
          Find out what you&rsquo;re <span className="italic text-rust">actually</span> like at this.
        </h2>
        <div className="col-span-12 flex items-end md:col-span-4 md:justify-end">
          <Link href="/login?mode=signup" className="btn btn-rust text-[0.95rem]">
            Start today&rsquo;s task <ArrowUpRight size={16} strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 py-10 text-sm text-mute md:flex-row md:items-center md:justify-between md:px-10">
        <Logo />
        <div className="flex gap-8">
          <a href="#" className="hover:text-ink">Product</a>
          <a href="#" className="hover:text-ink">For teams</a>
          <a href="#" className="hover:text-ink">Privacy</a>
        </div>
        <span className="font-mono text-[0.72rem]">© 2026 PromptIQ · Demo build</span>
      </div>
    </footer>
  );
}
