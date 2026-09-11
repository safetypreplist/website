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

const CACHE_KEY = "spl-local-conditions";
const CACHE_MS = 15 * 60 * 1000;

type Cache = { at: number; lat: number; lon: number; data: LocalConditions };

type PlaceJson = {
  city?: string;
  locality?: string;
  principalSubdivisionCode?: string;
  latitude?: number;
  longitude?: number;
};

function readCache(lat: number, lon: number): LocalConditions | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Cache;
    if (Date.now() - cache.at > CACHE_MS) return null;
    if (Math.abs(cache.lat - lat) > 0.05 || Math.abs(cache.lon - lon) > 0.05) return null;
    return cache.data;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lon: number, data: LocalConditions) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), lat, lon, data }));
  } catch {
    /* private mode */
  }
}

function weatherLabel(code: number) {
  return WMO[code] || "Local weather";
}

function formatPlace(json: PlaceJson) {
  const city = json.city || json.locality || "Your location";
  const region = json.principalSubdivisionCode?.split("-")[1];
  return region ? `${city}, ${region}` : city;
}

async function placeName(lat: number, lon: number) {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  );
  if (!res.ok) return "Your location";
  return formatPlace((await res.json()) as PlaceJson);
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

export async function loadLocalConditions(lat: number, lon: number, knownPlace?: string): Promise<LocalConditions> {
  const cached = readCache(lat, lon);
  if (cached) return cached;

  const [place, weatherRes] = await Promise.all([
    knownPlace ? Promise.resolve(knownPlace) : placeName(lat, lon),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`,
    ),
  ]);

  if (!weatherRes.ok) throw new Error("Weather unavailable");
  const weather = (await weatherRes.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const temp = Math.round(weather.current?.temperature_2m ?? 0);
  const code = weather.current?.weather_code ?? -1;
  const label = weatherLabel(code);
  const data = { place, temp, label, code };
  writeCache(lat, lon, data);
  return data;
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
