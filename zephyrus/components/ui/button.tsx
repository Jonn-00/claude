import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "quiet" | "ember";

const styles: Record<Variant, string> = {
  // Primary by inversion, never by hue.
  primary: "bg-text text-ground hover:bg-white font-medium",
  ghost: "border border-control text-text hover:border-sand hover:bg-raised",
  quiet: "text-muted hover:text-text hover:bg-raised",
  ember: "border border-ember/50 text-ember-soft hover:bg-ember-tint",
};

export function Button({
  variant = "ghost",
  size = "md",
  className,
  ...rest
}: { variant?: Variant; size?: "sm" | "md" } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "h-9 px-4 text-[14px]" : "h-8 px-3 text-[13px]",
        styles[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-control px-1 font-sans text-[11px] text-faint", className)}>
      {children}
    </kbd>
  );
}
