/** Zephyrus, the west wind: three gusts, the lowest one lit. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <rect width="28" height="28" rx="8" fill="var(--raised)" />
      <g fill="none" strokeLinecap="round" strokeWidth="2">
        <path d="M6 9.5h10.5a2.75 2.75 0 1 0-2.6-3.6" stroke="var(--sand)" />
        <path d="M6 14h15a2.75 2.75 0 1 1-2.6 3.6" stroke="var(--muted)" />
        <path d="M6 18.5h7" stroke="var(--ember)" />
      </g>
    </svg>
  );
}
