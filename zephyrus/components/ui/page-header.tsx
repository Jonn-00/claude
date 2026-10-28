export function PageHeader({ title, line, actions }: { title: string; line?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-9 font-semibold tracking-[-0.02em]">{title}</h1>
        {line && <p className="num mt-0.5 text-[15px] text-muted">{line}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
