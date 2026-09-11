type IconProps = { className?: string };

function LineIcon({ className = "line-icon", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconBackpack(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
      <path d="M7 7h10v13H7z" />
      <path d="M10 12h4" />
      <path d="M7 10h-1.5M17 10h1.5" />
    </LineIcon>
  );
}

export function IconDuffel(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 14c0-2 2-4 5-4h6c3 0 5 2 5 4v4H4v-4Z" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
      <path d="M4 16h16" />
    </LineIcon>
  );
}

export function IconCar(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 15h16v3H4z" />
      <path d="M6 15 8 10h8l2 5" />
      <circle cx="7.5" cy="18.5" r="1.2" />
      <circle cx="16.5" cy="18.5" r="1.2" />
    </LineIcon>
  );
}

export function IconHouse(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M4 11 12 4l8 7v9H4v-9Z" />
      <path d="M10 20v-6h4v6" />
    </LineIcon>
  );
}

export function IconChecklist(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M8 6h11" />
      <path d="M8 12h11" />
      <path d="M8 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </LineIcon>
  );
}

export function IconLock(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </LineIcon>
  );
}

export function IconUser(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1.2-3.2 3.6-5 7-5s5.8 1.8 7 5" />
    </LineIcon>
  );
}

export function IconNotes(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M7 4h8l4 4v12H7z" />
      <path d="M15 4v4h4" />
      <path d="M10 12h6" />
      <path d="M10 16h4" />
    </LineIcon>
  );
}

export function IconDevices(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="3" y="5" width="12" height="10" rx="1.2" />
      <path d="M7 19h4" />
      <rect x="16" y="10" width="5" height="9" rx="1" />
    </LineIcon>
  );
}

export function IconOffgrid(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 3 5 12h7l-2 9 9-11h-7l2-7Z" />
    </LineIcon>
  );
}

export function IconWater(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 3c3.5 5 6 8.2 6 11a6 6 0 0 1-12 0c0-2.8 2.5-6 6-11Z" />
    </LineIcon>
  );
}

export function IconSolar(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </LineIcon>
  );
}

export function IconHeat(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M12 21a5 5 0 0 0 5-5c0-3-5-7-5-11 0 4-5 8-5 11a5 5 0 0 0 5 5Z" />
    </LineIcon>
  );
}

export function IconFood(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M8 3v10" />
      <path d="M8 8c-2 0-3 1.4-3 3v2" />
      <path d="M16 3v18" />
      <path d="M13 3h6" />
    </LineIcon>
  );
}

export function IconPrint(props: IconProps) {
  return (
    <LineIcon {...props}>
      <path d="M8 3h7l3 3v15H8z" />
      <path d="M15 3v3h3" />
      <path d="M11 12h5" />
      <path d="M11 15h3.5" />
    </LineIcon>
  );
}

export function IconDesktop(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </LineIcon>
  );
}

export function IconTablet(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="6" y="3" width="12" height="18" rx="1.8" />
      <path d="M12 17.5h.01" />
    </LineIcon>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <LineIcon {...props}>
      <rect x="8" y="3" width="8" height="18" rx="1.6" />
      <path d="M12 17.5h.01" />
    </LineIcon>
  );
}

export const SYSTEM_ICONS = {
  "05": IconBackpack,
  "15": IconDuffel,
  "20": IconCar,
  "60": IconHouse,
} as const;

export const MARK_IMAGES = {
  backpack: "/images/backpack.png",
  duffel: "/images/duffel.png",
  vehicle: "/images/vehicle.png",
  home: "/images/home.png",
  checklist: "/images/checklist.png",
  household: "/images/household.png",
  bag: "/images/prep-bag.png",
} as const;

export const SYSTEM_MARKS = {
  "05": "backpack",
  "15": "duffel",
  "20": "vehicle",
  "60": "home",
} as const;

export function MarkImg({
  name,
  className = "",
}: {
  name: keyof typeof MARK_IMAGES;
  className?: string;
}) {
  return <img className={`mark-img ${className}`.trim()} src={MARK_IMAGES[name]} alt="" />;
}
