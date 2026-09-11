const wrap = { width: "100%", height: "100%" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 160" style={wrap} aria-hidden="true">
      <rect width="160" height="160" fill="#E6E2D6" />
      <path d="M0 128c20-10 40 6 62-4s38-4 58 6 28-8 40-2v32H0Z" fill="#C4A07A" opacity=".35" />
      {children}
    </svg>
  );
}

export function Illustration({ name }: { name?: string | null }) {
  switch (name) {
    case "duffel":
      return <Duffel />;
    case "suv":
      return <Suv />;
    case "cabin":
      return <Cabin />;
    case "lantern":
      return <Lantern />;
    case "filter":
      return <Filter />;
    case "compass":
      return <Compass />;
    case "solar":
      return <Solar />;
    case "pine":
      return <Pine />;
    case "radio":
      return <Radio />;
    default:
      return <Backpack />;
  }
}

function Backpack() {
  return (
    <Frame>
      <path d="M52 58h56v10H52z" fill="#556B2F" />
      <rect x="48" y="66" width="64" height="62" rx="10" fill="#1E2A1F" />
      <rect x="58" y="78" width="44" height="28" rx="6" fill="#A67C52" />
      <path d="M70 48h20v12H70z" fill="#C75A2B" />
      <circle cx="80" cy="118" r="4" fill="#E6E2D6" />
    </Frame>
  );
}

function Duffel() {
  return (
    <Frame>
      <ellipse cx="80" cy="108" rx="52" ry="18" fill="#1E2A1F" />
      <path d="M28 92c0-18 24-32 52-32s52 14 52 32v16H28Z" fill="#556B2F" />
      <path d="M40 74c8-6 24-10 40-10s32 4 40 10" stroke="#A67C52" strokeWidth="4" fill="none" />
      <rect x="72" y="84" width="16" height="10" rx="2" fill="#C75A2B" />
    </Frame>
  );
}

function Suv() {
  return (
    <Frame>
      <path d="M24 104h112l-8 16H32Z" fill="#1E2A1F" />
      <path d="M30 104 46 78h52l32 26Z" fill="#556B2F" />
      <rect x="52" y="84" width="22" height="14" fill="#E6E2D6" />
      <rect x="80" y="84" width="22" height="14" fill="#E6E2D6" />
      <circle cx="48" cy="116" r="10" fill="#1E2A1F" />
      <circle cx="112" cy="116" r="10" fill="#1E2A1F" />
      <circle cx="48" cy="116" r="4" fill="#A67C52" />
      <circle cx="112" cy="116" r="4" fill="#A67C52" />
    </Frame>
  );
}

function Cabin() {
  return (
    <Frame>
      <path d="M24 86 80 42l56 44v46H24Z" fill="#1E2A1F" />
      <path d="M80 42 136 86H24Z" fill="#556B2F" />
      <rect x="70" y="96" width="20" height="36" fill="#A67C52" />
      <rect x="40" y="96" width="18" height="16" fill="#E6E2D6" />
      <rect x="102" y="96" width="18" height="16" fill="#E6E2D6" />
    </Frame>
  );
}

function Lantern() {
  return (
    <Frame>
      <rect x="68" y="40" width="24" height="8" fill="#1E2A1F" />
      <path d="M58 52h44l-6 56H64Z" fill="#C75A2B" />
      <rect x="70" y="62" width="20" height="28" fill="#E6E2D6" />
      <rect x="62" y="108" width="36" height="10" fill="#1E2A1F" />
    </Frame>
  );
}

function Filter() {
  return (
    <Frame>
      <path d="M56 44h48v16l-16 28v28H72V88L56 60Z" fill="#1E2A1F" />
      <path d="M64 52h32v6L80 84 64 58Z" fill="#6D8640" />
      <circle cx="80" cy="118" r="6" fill="#A67C52" />
    </Frame>
  );
}

function Compass() {
  return (
    <Frame>
      <circle cx="80" cy="86" r="40" fill="#1E2A1F" />
      <circle cx="80" cy="86" r="30" fill="#E6E2D6" />
      <path d="M80 62 88 86 80 110 72 86Z" fill="#C75A2B" />
      <circle cx="80" cy="86" r="4" fill="#1E2A1F" />
    </Frame>
  );
}

function Solar() {
  return (
    <Frame>
      <rect x="36" y="52" width="88" height="56" rx="6" fill="#1E2A1F" />
      <path d="M36 52h88l-10 16H46Z" fill="#556B2F" />
      <path d="M48 76h64M48 90h64M72 68v32M96 68v32" stroke="#E6E2D6" strokeWidth="3" />
      <rect x="74" y="108" width="12" height="16" fill="#A67C52" />
    </Frame>
  );
}

function Pine() {
  return (
    <Frame>
      <path d="M80 36 112 84H48Z" fill="#556B2F" />
      <path d="M80 58 118 110H42Z" fill="#1E2A1F" />
      <rect x="74" y="108" width="12" height="22" fill="#A67C52" />
    </Frame>
  );
}

function Radio() {
  return (
    <Frame>
      <rect x="40" y="58" width="80" height="54" rx="8" fill="#1E2A1F" />
      <circle cx="68" cy="84" r="14" fill="#A67C52" />
      <rect x="90" y="72" width="20" height="8" fill="#E6E2D6" />
      <rect x="90" y="86" width="20" height="8" fill="#E6E2D6" />
      <path d="M108 46l16 20" stroke="#C75A2B" strokeWidth="4" />
    </Frame>
  );
}
