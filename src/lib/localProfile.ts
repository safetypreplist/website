export type LocalProfileLocation = {
  place: string;
  lat: number;
  lon: number;
  stateCode: string | null;
};

export type LocalProfile = {
  firstName: string;
  lastName: string;
  /** Derived full name for checklist titles and greetings. */
  displayName: string;
  avatarDataUrl: string | null;
  location: LocalProfileLocation | null;
};

const PROFILE_KEY = "spl.localProfile.v1";

const EMPTY: LocalProfile = {
  firstName: "",
  lastName: "",
  displayName: "",
  avatarDataUrl: null,
  location: null,
};

export function composeDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

export function isLocalProfileComplete(profile: Pick<LocalProfile, "firstName" | "lastName" | "location">) {
  return Boolean(profile.firstName.trim() && profile.lastName.trim() && profile.location?.place);
}

/** Compact place label for dashboard chrome, e.g. "Henderson, NV". */
export function locationDisplayLabel(location?: LocalProfileLocation | null) {
  if (!location?.place) return "";
  const city = location.place.split(",")[0]?.trim() || location.place.trim();
  if (location.stateCode) return `${city}, ${location.stateCode}`;
  return location.place.trim();
}

function splitLegacyDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeLocation(raw: unknown): LocalProfileLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<LocalProfileLocation>;
  if (
    typeof row.place !== "string" ||
    typeof row.lat !== "number" ||
    typeof row.lon !== "number" ||
    !row.place.trim() ||
    !Number.isFinite(row.lat) ||
    !Number.isFinite(row.lon)
  ) {
    return null;
  }
  return {
    place: row.place.trim(),
    lat: row.lat,
    lon: row.lon,
    stateCode: typeof row.stateCode === "string" ? row.stateCode : null,
  };
}

export function loadLocalProfile(): LocalProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<LocalProfile> & { displayName?: string };
    const legacyName = typeof parsed.displayName === "string" ? parsed.displayName.trim() : "";
    const split = splitLegacyDisplayName(legacyName);
    const firstName =
      typeof parsed.firstName === "string" && parsed.firstName.trim()
        ? parsed.firstName.trim()
        : split.firstName;
    const lastName =
      typeof parsed.lastName === "string" && parsed.lastName.trim()
        ? parsed.lastName.trim()
        : split.lastName;
    return {
      firstName,
      lastName,
      displayName: composeDisplayName(firstName, lastName) || legacyName,
      avatarDataUrl:
        typeof parsed.avatarDataUrl === "string" && parsed.avatarDataUrl.startsWith("data:")
          ? parsed.avatarDataUrl
          : null,
      location: normalizeLocation(parsed.location),
    };
  } catch {
    return { ...EMPTY };
  }
}

export type LocalProfileInput = Omit<LocalProfile, "displayName"> & { displayName?: string };

export function saveLocalProfile(profile: LocalProfileInput) {
  const firstName = profile.firstName.trim();
  const lastName = profile.lastName.trim();
  const next: LocalProfile = {
    firstName,
    lastName,
    displayName: composeDisplayName(firstName, lastName),
    avatarDataUrl: profile.avatarDataUrl,
    location: profile.location,
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalProfileAvatar(profile: LocalProfile) {
  return saveLocalProfile({ ...profile, avatarDataUrl: null });
}

/** Stable brand-toned color for initials avatars. */
export function avatarColorFrom(seed?: string | null) {
  const palette = ["#3f5d45", "#6b7f4f", "#8b5a3c", "#a67c52", "#2f4a38", "#7a6540"];
  const text = (seed || "SP").trim().toUpperCase() || "SP";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
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
