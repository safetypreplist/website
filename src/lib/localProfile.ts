export type LocalProfileLocation = {
  place: string;
  lat: number;
  lon: number;
  stateCode: string | null;
};

export type LocalProfile = {
  displayName: string;
  avatarDataUrl: string | null;
  location: LocalProfileLocation | null;
};

const PROFILE_KEY = "spl.localProfile.v1";

const EMPTY: LocalProfile = {
  displayName: "",
  avatarDataUrl: null,
  location: null,
};

export function loadLocalProfile(): LocalProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName.trim() : "",
      avatarDataUrl: typeof parsed.avatarDataUrl === "string" && parsed.avatarDataUrl.startsWith("data:") ? parsed.avatarDataUrl : null,
      location:
        parsed.location &&
        typeof parsed.location.place === "string" &&
        typeof parsed.location.lat === "number" &&
        typeof parsed.location.lon === "number"
          ? {
              place: parsed.location.place,
              lat: parsed.location.lat,
              lon: parsed.location.lon,
              stateCode: typeof parsed.location.stateCode === "string" ? parsed.location.stateCode : null,
            }
          : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveLocalProfile(profile: LocalProfile) {
  const next: LocalProfile = {
    displayName: profile.displayName.trim(),
    avatarDataUrl: profile.avatarDataUrl,
    location: profile.location,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalProfileAvatar(profile: LocalProfile) {
  return saveLocalProfile({ ...profile, avatarDataUrl: null });
}

export type GeocodeHit = {
  place: string;
  lat: number;
  lon: number;
  stateCode: string | null;
};

export async function searchPlaces(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", "US");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Could not search that place.");
  const json = (await res.json()) as {
    results?: Array<{
      name?: string;
      admin1?: string;
      admin1_code?: string;
      latitude?: number;
      longitude?: number;
    }>;
  };
  return (json.results || [])
    .filter((row) => typeof row.latitude === "number" && typeof row.longitude === "number" && row.name)
    .map((row) => {
      const stateCode = row.admin1_code?.includes("-")
        ? row.admin1_code.split("-")[1] || null
        : row.admin1_code || null;
      const place = [row.name, row.admin1].filter(Boolean).join(", ");
      return {
        place,
        lat: row.latitude as number,
        lon: row.longitude as number,
        stateCode,
      };
    });
}
