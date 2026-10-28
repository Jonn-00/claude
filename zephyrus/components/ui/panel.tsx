import { cn } from "@/lib/utils";

/**
 * A surface one lightness step above the ground. `framed` adds the Ink Orbit
 * corner marks that open on hover; `lit` brings it forward in ember when it
 * needs you.
 */
export function Panel({
  title,
  aside,
  framed,
  lit,
  className,
  bodyClassName,
  children,
  id,
  ...rest
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  framed?: boolean;
  lit?: boolean;
  bodyClassName?: string;
} & Omit<React.ComponentProps<"section">, "title">) {
  return (
    <section
      id={id}
      className={cn(
        "relative flex min-w-0 flex-col rounded-[18px] border border-border bg-surface bg-[linear-gradient(180deg,rgb(255_255_255/0.028),transparent_140px)]", // taste-skill-ignore: the reference's soft top light on cards
        framed && "frame",
        lit && "lit",
        className,
      )}
      {...rest}
    >
      {framed && (
        <>
          <span className="corner tl" aria-hidden />
          <span className="corner tr" aria-hidden />
          <span className="corner bl" aria-hidden />
          <span className="corner br" aria-hidden />
        </>
      )}
      {(title || aside) && (
        <header className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-2">
          {title && <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>}
          {aside && <div className="flex items-center gap-2 text-[13px] text-muted">{aside}</div>}
        </header>
      )}
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col px-5 pb-5", !(title || aside) && "pt-5", bodyClassName)}>{children}</div>
    </section>
  );
}
