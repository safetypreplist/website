import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { locationDisplayLabel } from "../lib/localProfile";
import {
  formatWeatherUpdatedAt,
  loadWeatherBundle,
  weatherKind,
  type WeatherBundle,
} from "../lib/weather";
import { WeatherGlyph } from "./LocationStatus";

type Mode = "day" | "week";

export function SidebarWeather({ compact = false }: { compact?: boolean }) {
  const { localProfile } = useApp();
  const location = localProfile.location;
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [mode, setMode] = useState<Mode>("day");
  const [error, setError] = useState("");
  const place = locationDisplayLabel(location) || location?.place || "";

  useEffect(() => {
    if (!location) {
      setBundle(null);
      setError("");
      return;
    }
    let cancelled = false;
    setError("");
    void loadWeatherBundle(location.lat, location.lon, place)
      .then((next) => {
        if (!cancelled) setBundle(next);
      })
      .catch(() => {
        if (!cancelled) {
          setBundle(null);
          setError("Weather unavailable right now. Your checklists still work offline.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [location, place]);

  if (!location) {
    return (
      <aside className={`sidebar-weather is-off${compact ? " is-compact" : ""}`}>
        <p className="sidebar-weather-title">Today&apos;s Weather</p>
        <p className="sidebar-weather-empty">
          Location helps provide accurate local time, weather, and safety resources. Your checklists stay available
          either way.
        </p>
        <Link className="sidebar-weather-link" to="/app/profile">
          Set location
        </Link>
      </aside>
    );
  }

  const today = bundle?.days[0];
  const current = bundle?.current;

  return (
    <aside className={`sidebar-weather${compact ? " is-compact" : ""}`}>
      <div className="sidebar-weather-head">
        <p className="sidebar-weather-title">Today&apos;s Weather</p>
        <Link className="sidebar-weather-link" to="/app/profile">
          Edit
        </Link>
      </div>

      {error && !bundle ? <p className="sidebar-weather-empty">{error}</p> : null}

      {!error && !bundle ? <p className="sidebar-weather-empty">Updating weather…</p> : null}

      {current && mode === "day" ? (
        <div className="sidebar-weather-row">
          <WeatherGlyph kind={weatherKind(current.code)} />
          <div className="sidebar-weather-copy">
            <strong>
              {current.temp}° · {current.label}
            </strong>
            {today ? (
              <span>
                High {today.high}° · Low {today.low}°
              </span>
            ) : null}
            <span className="sidebar-weather-place">{place}</span>
            {bundle?.updatedAt ? (
              <span className={`sidebar-weather-updated${bundle.stale ? " is-stale" : ""}`}>
                {formatWeatherUpdatedAt(bundle.updatedAt, Boolean(bundle.stale))}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {bundle && mode === "week" ? (
        <ul className="sidebar-weather-week">
          {bundle.days.map((day) => (
            <li key={day.date}>
              <span className="sidebar-weather-weekday">{day.weekday}</span>
              <WeatherGlyph kind={weatherKind(day.code)} />
              <span className="sidebar-weather-temps">
                {day.high}° / {day.low}°
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {bundle ? (
        <div className="sidebar-weather-toggles" role="tablist" aria-label="Weather view">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "day"}
            className={`weather-toggle${mode === "day" ? " is-active" : ""}`}
            onClick={() => setMode("day")}
          >
            Today
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "week"}
            className={`weather-toggle${mode === "week" ? " is-active" : ""}`}
            onClick={() => setMode("week")}
          >
            Week
          </button>
        </div>
      ) : null}
    </aside>
  );
}
