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
  return Boolean(composeDisplayName(profile.firstName, profile.lastName) && profile.location?.place);
}

/** Compact place label for dashboard chrome, e.g. "Henderson, NV". */
export function locationDisplayLabel(location?: LocalProfileLocation | null) {
  if (!location?.place) return "";
  const city = location.place.split(",")[0]?.trim() || location.place.trim();
  if (location.stateCode) return `${city}, ${location.stateCode}`;
  return location.place.trim();
}

export function splitFullName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function splitLegacyDisplayName(displayName: string) {
  return splitFullName(displayName);
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

export function normalizeZipCode(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  return "";
}

/** Resolve a US ZIP to city/state coordinates for profile location. */
export async function lookupZipCode(zipInput: string): Promise<GeocodeHit> {
  const zip = normalizeZipCode(zipInput);
  if (!/^\d{5}$/.test(zip)) throw new Error("Enter a valid 5-digit ZIP code.");

  try {
    const zipRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (zipRes.ok) {
      const json = (await zipRes.json()) as {
        places?: Array<{
          "place name"?: string;
          state?: string;
          "state abbreviation"?: string;
          latitude?: string;
          longitude?: string;
        }>;
      };
      const place = json.places?.[0];
      const lat = place?.latitude ? Number(place.latitude) : NaN;
      const lon = place?.longitude ? Number(place.longitude) : NaN;
      if (place?.["place name"] && Number.isFinite(lat) && Number.isFinite(lon)) {
        const stateCode = place["state abbreviation"] || null;
        return {
          place: stateCode ? `${place["place name"]}, ${stateCode}` : place["place name"],
          lat,
          lon,
          stateCode,
        };
      }
    }
  } catch {
    /* fall through to Open-Meteo */
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", zip);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", "US");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Could not find that ZIP code.");
  const json = (await res.json()) as {
    results?: Array<{
      name?: string;
      admin1?: string;
      admin1_code?: string;
      latitude?: number;
      longitude?: number;
    }>;
  };
  const row = json.results?.[0];
  if (!row || typeof row.latitude !== "number" || typeof row.longitude !== "number" || !row.name) {
    throw new Error("Could not find that ZIP code.");
  }
  const stateCode = row.admin1_code?.includes("-")
    ? row.admin1_code.split("-")[1] || null
    : row.admin1_code || null;
  return {
    place: [row.name, stateCode || row.admin1].filter(Boolean).join(", "),
    lat: row.latitude,
    lon: row.longitude,
    stateCode,
  };
}
