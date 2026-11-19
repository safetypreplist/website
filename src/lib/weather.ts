const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Rain",
  71: "Snow",
  73: "Snow",
  75: "Snow",
  80: "Showers",
  81: "Showers",
  82: "Showers",
  95: "Thunder",
  96: "Thunder",
  99: "Thunder",
};

export type LocalConditions = {
  place: string;
  temp: number;
  label: string;
  code: number;
};

export type WeatherKind = "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm";

export function weatherKind(code: number): WeatherKind {
  if (code === 0 || code === 1) return "sun";
  if (code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "cloud";
}

const CONDITIONS_CACHE_KEY = "spl.localConditions.v1";
const FORECAST_CACHE_KEY = "spl.localForecast.v1";
const TIMEZONE_KEY = "spl.localTimezone.v1";
const FRESH_MS = 20 * 60 * 1000;

type ConditionsCache = { at: number; lat: number; lon: number; data: LocalConditions };
type ForecastCache = { at: number; lat: number; lon: number; data: WeatherBundle };

type PlaceJson = {
  city?: string;
  locality?: string;
  principalSubdivisionCode?: string;
  latitude?: number;
  longitude?: number;
};

function near(a: number, b: number) {
  return Math.abs(a - b) <= 0.05;
}

function weatherLabel(code: number) {
  return WMO[code] || "Local weather";
}

function formatPlace(json: PlaceJson) {
  const city = json.city || json.locality || "Your location";
  const region = json.principalSubdivisionCode?.split("-")[1];
  return region ? `${city}, ${region}` : city;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(key, raw);
  } catch {
    try {
      sessionStorage.setItem(key, raw);
    } catch {
      /* private mode */
    }
  }
}

export function saveLocalTimezone(timeZone: string | null | undefined) {
  if (!timeZone) return;
  try {
    localStorage.setItem(TIMEZONE_KEY, timeZone);
  } catch {
    /* private mode */
  }
}

export function loadLocalTimezone(): string | null {
  try {
    return localStorage.getItem(TIMEZONE_KEY);
  } catch {
    return null;
  }
}

function readConditionsCache(lat: number, lon: number): ConditionsCache | null {
  const cache = readJson<ConditionsCache>(CONDITIONS_CACHE_KEY);
  if (!cache || !near(cache.lat, lat) || !near(cache.lon, lon)) return null;
  return cache;
}

function writeConditionsCache(lat: number, lon: number, data: LocalConditions) {
  writeJson(CONDITIONS_CACHE_KEY, { at: Date.now(), lat, lon, data } satisfies ConditionsCache);
}

function normalizeBundle(data: WeatherBundle): WeatherBundle {
  return {
    current: data.current,
    days: Array.isArray(data.days) ? data.days : [],
    timezone: data.timezone || null,
    updatedAt: data.updatedAt || new Date().toISOString(),
    stale: data.stale,
  };
}

function readForecastCache(lat: number, lon: number): ForecastCache | null {
  const cache = readJson<ForecastCache>(FORECAST_CACHE_KEY);
  if (!cache?.data?.current || !near(cache.lat, lat) || !near(cache.lon, lon)) return null;
  return { ...cache, data: normalizeBundle(cache.data) };
}

function writeForecastCache(lat: number, lon: number, data: WeatherBundle) {
  writeJson(FORECAST_CACHE_KEY, { at: Date.now(), lat, lon, data } satisfies ForecastCache);
}

export async function placeName(lat: number, lon: number) {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  );
  if (!res.ok) return "Your location";
  return formatPlace((await res.json()) as PlaceJson);
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ place: string; stateCode: string | null }> {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  );
  if (!res.ok) return { place: "Your location", stateCode: null };
  const json = (await res.json()) as PlaceJson;
  const stateCode = json.principalSubdivisionCode?.includes("-")
    ? json.principalSubdivisionCode.split("-")[1] || null
    : json.principalSubdivisionCode || null;
  return { place: formatPlace(json), stateCode };
}

export async function lookupIpLocation(): Promise<{ lat: number; lon: number; place: string }> {
  const res = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en");
  if (!res.ok) throw new Error("Location unavailable");
  const json = (await res.json()) as PlaceJson;
  if (typeof json.latitude !== "number" || typeof json.longitude !== "number") {
    throw new Error("Location unavailable");
  }
  return { lat: json.latitude, lon: json.longitude, place: formatPlace(json) };
}

export type DayForecast = {
  date: string;
  weekday: string;
  high: number;
  low: number;
  code: number;
  label: string;
};

export type WeatherBundle = {
  current: LocalConditions;
  days: DayForecast[];
  timezone: string | null;
  updatedAt: string;
  stale?: boolean;
};

export function formatWeatherUpdatedAt(iso: string, stale = false) {
  try {
    const stamp = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
    return stale ? `Previously updated ${stamp}` : `Updated ${stamp}`;
  } catch {
    return stale ? "Previously updated" : "Updated just now";
  }
}

export async function loadLocalConditions(lat: number, lon: number, knownPlace?: string): Promise<LocalConditions> {
  const cached = readConditionsCache(lat, lon);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.data;

  try {
    const [place, weatherRes] = await Promise.all([
      knownPlace ? Promise.resolve(knownPlace) : placeName(lat, lon),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`,
      ),
    ]);

    if (!weatherRes.ok) throw new Error("Weather unavailable");
    const weather = (await weatherRes.json()) as {
      timezone?: string;
      current?: { temperature_2m?: number; weather_code?: number };
    };
    saveLocalTimezone(weather.timezone);
    const temp = Math.round(weather.current?.temperature_2m ?? 0);
    const code = weather.current?.weather_code ?? -1;
    const data = { place, temp, label: weatherLabel(code), code };
    writeConditionsCache(lat, lon, data);
    return data;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

export async function loadWeatherBundle(lat: number, lon: number, knownPlace?: string): Promise<WeatherBundle> {
  const cached = readForecastCache(lat, lon);
  const fresh = cached && Date.now() - cached.at < FRESH_MS;

  if (!navigator.onLine && cached) {
    return { ...cached.data, stale: true };
  }
  if (fresh && cached) {
    return { ...cached.data, stale: false };
  }

  try {
    const [place, weatherRes] = await Promise.all([
      knownPlace ? Promise.resolve(knownPlace) : placeName(lat, lon),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`,
      ),
    ]);

    if (!weatherRes.ok) throw new Error("Weather unavailable");
    const weather = (await weatherRes.json()) as {
      timezone?: string;
      current?: { temperature_2m?: number; weather_code?: number };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
      };
    };

    const timezone = weather.timezone || null;
    saveLocalTimezone(timezone);

    const code = weather.current?.weather_code ?? -1;
    const current: LocalConditions = {
      place,
      temp: Math.round(weather.current?.temperature_2m ?? 0),
      label: weatherLabel(code),
      code,
    };
    writeConditionsCache(lat, lon, current);

    const times = weather.daily?.time || [];
    const days: DayForecast[] = times.map((date, index) => {
      const dayCode = weather.daily?.weather_code?.[index] ?? -1;
      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T12:00:00`));
      return {
        date,
        weekday,
        high: Math.round(weather.daily?.temperature_2m_max?.[index] ?? 0),
        low: Math.round(weather.daily?.temperature_2m_min?.[index] ?? 0),
        code: dayCode,
        label: weatherLabel(dayCode),
      };
    });

    const data: WeatherBundle = {
      current,
      days,
      timezone,
      updatedAt: new Date().toISOString(),
      stale: false,
    };
    writeForecastCache(lat, lon, data);
    return data;
  } catch (err) {
    if (cached) return { ...cached.data, stale: true };
    throw err;
  }
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30 * 60 * 1000,
    });
  });
}
