import { useEffect, useState } from "react";
import {
  getCurrentPosition,
  loadLocalConditions,
  lookupIpLocation,
  weatherKind,
  type LocalConditions,
  type WeatherKind,
} from "../lib/weather";

const HIDE_KEY = "spl-hide-weather";

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function useWeatherHidden() {
  const [hidden, setHidden] = useState(readHidden);

  useEffect(() => {
    const sync = () => setHidden(readHidden());
    window.addEventListener("spl-weather-hide", sync);
    return () => window.removeEventListener("spl-weather-hide", sync);
  }, []);

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* private mode */
    }
    setHidden(true);
    window.dispatchEvent(new Event("spl-weather-hide"));
  };

  const show = () => {
    try {
      localStorage.removeItem(HIDE_KEY);
    } catch {
      /* private mode */
    }
    setHidden(false);
    window.dispatchEvent(new Event("spl-weather-hide"));
  };

  return { hidden, hide, show };
}

function clockParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(now);

  const grab = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const date = `${grab("weekday")}, ${grab("month")} ${grab("day")}`;
  const time = `${grab("hour")}:${grab("minute")} ${grab("dayPeriod")}`.replace(/\s+/g, " ").trim();
  const zone = grab("timeZoneName");
  return { date, time, zone };
}

export function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const { date, time, zone } = clockParts(now);

  return (
    <p className="app-clock">
      {date} · <b>{time} {zone}</b>
    </p>
  );
}

export function SidebarWeather() {
  const { hidden, hide, show } = useWeatherHidden();
  const [conditions, setConditions] = useState<LocalConditions | null>(null);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;

    const apply = (next: LocalConditions) => {
      if (!cancelled) setConditions(next);
    };

    void (async () => {
      try {
        const ip = await lookupIpLocation();
        apply(await loadLocalConditions(ip.lat, ip.lon, ip.place));
      } catch {
        /* IP lookup optional */
      }
    })();

    void (async () => {
      try {
        const position = await getCurrentPosition();
        apply(await loadLocalConditions(position.coords.latitude, position.coords.longitude));
      } catch {
        /* GPS optional */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hidden]);

  if (hidden) {
    return (
      <div className="sidebar-weather is-off">
        <button className="weather-toggle" type="button" onClick={show}>
          Show weather
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-weather">
      <div className="sidebar-weather-row">
        <WeatherGlyph kind={conditions ? weatherKind(conditions.code) : "cloud"} />
        <div className="sidebar-weather-copy">
          <strong>{conditions ? conditions.place : "Finding location…"}</strong>
          {conditions ? (
            <span>
              {conditions.temp}° · {conditions.label}
            </span>
          ) : (
            <span>Updating…</span>
          )}
        </div>
      </div>
      <button className="weather-toggle" type="button" onClick={hide}>
        Hide
      </button>
    </div>
  );
}

function WeatherGlyph({ kind }: { kind: WeatherKind }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "sun") {
    return (
      <svg className="weather-icon" {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2 7.6 7.6M16.4 16.4l1.4 1.4M6.2 17.8 7.6 16.4M16.4 7.6l1.4-1.4" />
      </svg>
    );
  }
  if (kind === "partly") {
    return (
      <svg className="weather-icon" {...common}>
        <circle cx="9" cy="9" r="3" />
        <path d="M9 4v1.2M4 9H2.8M5.4 5.4l.8.8" />
        <path d="M7 16h9a3.5 3.5 0 1 0-.4-7 5 5 0 0 0-9.3 1.6A3.5 3.5 0 0 0 7 16Z" />
      </svg>
    );
  }
  if (kind === "rain") {
    return (
      <svg className="weather-icon" {...common}>
        <path d="M7 15h9a3.5 3.5 0 1 0-.4-7 5 5 0 0 0-9.3 1.6A3.5 3.5 0 0 0 7 15Z" />
        <path d="M9.5 17.5 8 21M13 17.5 11.5 21M16.5 17.5 15 21" />
      </svg>
    );
  }
  if (kind === "snow") {
    return (
      <svg className="weather-icon" {...common}>
        <path d="M7 14h9a3.5 3.5 0 1 0-.4-7 5 5 0 0 0-9.3 1.6A3.5 3.5 0 0 0 7 14Z" />
        <path d="M9 18v3M13 18v3M17 18v3M8 19.5h2M12 19.5h2M16 19.5h2" />
      </svg>
    );
  }
  if (kind === "storm") {
    return (
      <svg className="weather-icon" {...common}>
        <path d="M7 14h9a3.5 3.5 0 1 0-.4-7 5 5 0 0 0-9.3 1.6A3.5 3.5 0 0 0 7 14Z" />
        <path d="m11 15 2.2 4h-2.4L13 22" />
      </svg>
    );
  }
  if (kind === "fog") {
    return (
      <svg className="weather-icon" {...common}>
        <path d="M5 10h14M4 14h16M6 18h12" />
      </svg>
    );
  }
  return (
    <svg className="weather-icon" {...common}>
      <path d="M7 16h9a3.5 3.5 0 1 0-.4-7 5 5 0 0 0-9.3 1.6A3.5 3.5 0 0 0 7 16Z" />
    </svg>
  );
}
