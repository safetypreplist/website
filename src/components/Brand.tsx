export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <img
      className={className}
      src="/brand/logo.png"
      alt=""
      width={208}
      height={256}
      decoding="async"
      aria-hidden="true"
    />
  );
}

export function Mountains({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
      <path fill="#141D16" d="M0 160 0 90 140 40 260 88 380 20 560 96 720 28 880 84 1040 36 1200 92 1200 160Z" />
      <path fill="#1E2A1F" d="M0 160 0 118 180 70 340 120 500 64 700 124 860 78 1200 128 1200 160Z" />
      <path fill="#2A3828" d="M0 160v-18l1200-22V160Z" />
    </svg>
  );
}
