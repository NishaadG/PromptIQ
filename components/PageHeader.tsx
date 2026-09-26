export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 border-b border-line px-5 pt-10 pb-8 md:flex-row md:items-end md:justify-between md:px-10">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display mt-3 text-[2.4rem] leading-[1.02] tracking-[-0.025em] md:text-[2.9rem]">{title}</h1>
      </div>
      {children}
    </div>
  );
}
