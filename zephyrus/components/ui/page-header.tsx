import { PHOTOS, UNSPLASH, type PhotoKey } from "@/lib/photos";

export function PageHeader({ title, line, actions, photo }: { title: React.ReactNode; line?: React.ReactNode; actions?: React.ReactNode; photo?: PhotoKey }) {
  const p = photo ? PHOTOS[photo] : null;
  const body = (
    <div className={p ? "relative z-[1] flex min-h-[208px] flex-wrap items-end justify-between gap-x-6 gap-y-3 px-6 pb-5 sm:min-h-[248px] sm:px-8 sm:pb-6" : "mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3"}>
      <div className="min-w-0">
        <h1 className={p ? "font-display text-[34px] leading-10 font-semibold tracking-[-0.025em] text-white" : "font-display text-[28px] leading-9 font-semibold tracking-[-0.02em]"}>{title}</h1>
        {line && <p className={p ? "num mt-1 text-[15px] text-white/80" : "num mt-0.5 text-[15px] text-muted"}>{line}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
  if (!p) return body;
  // The photo sits in a band that melts into the ground at its foot, the way the reference's scene runs into the page.
  return (
    <header className="photo-band relative mb-5 overflow-hidden rounded-[24px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized banner; the single-file build has no image optimiser */}
      <img src={p.src} alt={p.alt} className="photo-band-img absolute inset-0 size-full object-cover" />
      {body}
      <p className="absolute top-3 right-4 z-[1] rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] text-white/75 backdrop-blur-sm">
        Photo by{" "}
        <a href={p.profile} target="_blank" rel="noreferrer" className="text-white/90 hover:text-white hover:underline">
          {p.by}
        </a>{" "}
        on{" "}
        <a href={UNSPLASH} target="_blank" rel="noreferrer" className="text-white/90 hover:text-white hover:underline">
          Unsplash
        </a>
      </p>
    </header>
  );
}
