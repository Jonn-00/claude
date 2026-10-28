import { cn } from "@/lib/utils";

export type Kpi = { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "positive" | "negative" | "ember" | "neutral" };

/** One container split by hairlines; label over value, the change in words under it. */
export function KpiStrip({ items, className }: { items: Kpi[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 overflow-hidden rounded-[18px] border border-border bg-surface md:grid-cols-4", className)}>
      {items.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "min-w-0 px-5 py-4",
            i % 2 === 1 && "border-l border-border",
            i >= 2 && "border-t border-border md:border-t-0",
            i === 2 && "md:border-l",
          )}
        >
          <div className="text-[13px] text-muted">{k.label}</div>
          <div className="num mt-1.5 font-display text-[26px] leading-8 font-medium tracking-[-0.02em]">{k.value}</div>
          {k.sub && (
            <div
              className={cn(
                "num mt-0.5 text-[12px]",
                k.tone === "positive" ? "text-positive" : k.tone === "negative" ? "text-negative" : k.tone === "ember" ? "text-ember-soft" : "text-faint",
              )}
            >
              {k.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
