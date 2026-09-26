import Link from "next/link";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-baseline gap-[1px] ${className}`}>
      <span className="font-display text-[1.45rem] leading-none tracking-[-0.02em]">Prompt</span>
      <span className="font-display text-[1.45rem] italic leading-none text-rust">IQ</span>
      <span className="ml-1 inline-block h-1.5 w-1.5 translate-y-[-2px] bg-ink transition-colors group-hover:bg-rust" />
    </Link>
  );
}
