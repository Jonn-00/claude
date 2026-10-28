"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The Analytics Bento segmented control: a thumb that slides to the choice. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });
  const idx = Math.max(0, items.findIndex((i) => i.value === value));
  useLayoutEffect(() => {
    const b = refs.current[idx];
    if (b) setThumb({ x: b.offsetLeft, w: b.offsetWidth });
  }, [idx, items]);
  return (
    <div role="tablist" aria-label={label} className={cn("relative inline-grid h-8 shrink-0 auto-cols-fr grid-flow-col rounded-full bg-raised p-[3px]", className)}>
      <div
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-0 rounded-full bg-active transition-[transform,width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
        style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
      />
      {items.map((it, i) => (
        <button
          key={it.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          aria-selected={i === idx}
          onClick={() => onChange(it.value)}
          className={cn(
            "relative z-10 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors duration-150",
            i === idx ? "text-text" : "text-muted hover:text-text",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
