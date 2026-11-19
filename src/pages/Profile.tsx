import { FormEvent, useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useApp } from "../context/AppContext";
import { blobToDataUrl, compressAvatar } from "../lib/avatar";
import { composeDisplayName, searchPlaces, type GeocodeHit, type LocalProfileLocation } from "../lib/localProfile";
import { getCurrentPosition, reverseGeocode } from "../lib/weather";

export function ProfilePage() {
  const { localProfile, saveLocalProfile } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(localProfile.firstName);
  const [lastName, setLastName] = useState(localProfile.lastName);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(localProfile.avatarDataUrl);
  const [location, setLocation] = useState<LocalProfileLocation | null>(localProfile.location);
  const [query, setQuery] = useState(localProfile.location?.place || "");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFirstName(localProfile.firstName);
    setLastName(localProfile.lastName);
    setAvatarDataUrl(localProfile.avatarDataUrl);
    setLocation(localProfile.location);
    setQuery(localProfile.location?.place || "");
  }, [localProfile]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || (location && q === location.place)) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchPlaces(q)
        .then((next) => {
          if (!cancelled) setHits(next);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, location]);

  async function onPickPhoto(file: File | null) {
    setError("");
    setMessage("");
    if (!file) return;
    try {
      const blob = await compressAvatar(file);
      const dataUrl = await blobToDataUrl(blob);
      setAvatarDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use that photo.");
    }
  }

  async function useCurrentLocation() {
    setLocating(true);
    setError("");
    setMessage("");
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const geo = await reverseGeocode(lat, lon);
      const next: LocalProfileLocation = {
        place: geo.place,
        lat,
        lon,
        stateCode: geo.stateCode,
      };
      setLocation(next);
      setQuery(geo.place);
      setHits([]);
    } catch {
      setError("Could not read your current location. Search for a city instead.");
    } finally {
      setLocating(false);
    }
  }

  function pickHit(hit: GeocodeHit) {
    setLocation(hit);
    setQuery(hit.place);
    setHits([]);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setSaving(false);
      setError("First name and last name are required.");
      return;
    }
    if (!location) {
      setSaving(false);
      setError("Choose a location so weather and local resources know where you are.");
      return;
    }
    try {
      await saveLocalProfile({
        firstName: first,
        lastName: last,
        avatarDataUrl,
        location,
      });
      setMessage("Profile saved on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const previewName = composeDisplayName(firstName, lastName) || "Your name";

  return (
    <div className="account-page profile-page" data-onboarding="profile">
      <p className="eyebrow">Profile</p>
      <h1 className="page-title">Your profile</h1>
      <p className="muted help-lead">
        Your name, location, and optional photo stay on this device. The same avatar appears beside My Checklist, in the
        top-right corner, and on your homepage.
      </p>

      <form className="account-card" onSubmit={onSave}>
        <div className="account-photo">
          <ProfileAvatar className="account-photo-mark" name={previewName} avatarUrl={avatarDataUrl} />
          <div>
            <button className="btn btn-ghost" type="button" onClick={() => fileRef.current?.click()}>
              {avatarDataUrl ? "Change photo" : "Upload photo"}
            </button>
            {avatarDataUrl ? (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setAvatarDataUrl(null);
                  setMessage("");
                }}
              >
                Remove photo
              </button>
            ) : (
              <p className="muted">Optional. Without a photo, colored initials are used everywhere.</p>
            )}
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                event.target.value = "";
                void onPickPhoto(file);
              }}
            />
          </div>
        </div>

        <div className="profile-name-grid">
          <label className="account-field">
            <span>First name</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Jane"
              autoComplete="given-name"
              maxLength={40}
              required
            />
          </label>
          <label className="account-field">
            <span>Last name</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Doe"
              autoComplete="family-name"
              maxLength={40}
              required
            />
          </label>
        </div>

        <div className="account-field">
          <span>Location</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (location) setLocation(null);
            }}
            placeholder="City or town"
            autoComplete="address-level2"
            required
          />
          {searching ? <p className="muted">Searching…</p> : null}
          {hits.length ? (
            <ul className="profile-place-hits">
              {hits.map((hit) => (
                <li key={`${hit.place}-${hit.lat}-${hit.lon}`}>
                  <button type="button" onClick={() => pickHit(hit)}>
                    {hit.place}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="toolbar profile-location-tools">
            <button className="btn btn-ghost" type="button" disabled={locating} onClick={() => void useCurrentLocation()}>
              {locating ? "Locating…" : "Use current location"}
            </button>
            {location || query ? (
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setLocation(null);
                  setQuery("");
                  setHits([]);
                }}
              >
                Clear location
              </button>
            ) : null}
          </div>
          {location ? <p className="muted">Weather will use {location.place}.</p> : null}
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

        <button className="btn btn-forest" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
