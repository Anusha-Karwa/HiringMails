/**
 * The hiring symbol that sits behind every page: a magnifying glass over a candidate, with a
 * "shortlisted" tick and slow orbiting rings. Pure SVG in aqua at low opacity, so it adds depth
 * without competing with the data. Motion stops for prefers-reduced-motion.
 */
export function HiringBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -right-[12vw] top-[8vh] w-[min(92vw,960px)] text-brand-600 opacity-[0.06] sm:-right-[6vw]">
        <div className="motion-safe-anim animate-float">
          <svg viewBox="0 0 600 600" fill="none" className="h-auto w-full">
            <g className="motion-safe-anim origin-center animate-spinslow" style={{ transformBox: "fill-box" }}>
              <circle cx="300" cy="300" r="290" stroke="currentColor" strokeWidth="2" strokeDasharray="2 14" strokeLinecap="round" />
              <circle cx="300" cy="10" r="7" fill="currentColor" />
              <circle cx="590" cy="300" r="5" fill="currentColor" />
              <circle cx="95" cy="505" r="6" fill="currentColor" />
            </g>
            <circle cx="300" cy="300" r="235" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />

            {/* lens */}
            <circle cx="275" cy="265" r="150" stroke="currentColor" strokeWidth="12" />
            <circle cx="275" cy="265" r="128" stroke="currentColor" strokeWidth="2" opacity="0.5" />
            <clipPath id="lens-clip">
              <circle cx="275" cy="265" r="128" />
            </clipPath>
            {/* candidate inside the lens */}
            <g clipPath="url(#lens-clip)" fill="currentColor">
              <circle cx="275" cy="222" r="46" />
              <path d="M170 400c0-70 47-112 105-112s105 42 105 112z" />
            </g>
            {/* handle */}
            <path d="M383 373l118 118" stroke="currentColor" strokeWidth="34" strokeLinecap="round" />
            <path d="M383 373l30 30" stroke="currentColor" strokeWidth="46" strokeLinecap="round" />

            {/* shortlisted tick */}
            <circle cx="398" cy="148" r="34" fill="currentColor" />
            <path d="M382 149l11 11 22-24" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

            {/* CV lines */}
            <g stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity="0.7">
              <path d="M70 150h70M70 175h110M70 200h90" />
              <path d="M455 470h80M475 495h60" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="#4ad1c4" />
      <circle cx="18" cy="17" r="8.5" fill="none" stroke="#04211e" strokeWidth="3" />
      <circle cx="18" cy="15" r="2.8" fill="#04211e" />
      <path d="M13 22.5c1.2-2.6 3-3.6 5-3.6s3.8 1 5 3.6" fill="#04211e" />
      <path d="M24.5 23.5l6 6" stroke="#04211e" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
