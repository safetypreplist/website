import { FormEvent, useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "./ProfileAvatar";
import { useApp } from "../context/AppContext";
import { blobToDataUrl, compressAvatar } from "../lib/avatar";
import {
  composeDisplayName,
  searchPlaces,
  type GeocodeHit,
  type LocalProfileLocation,
} from "../lib/localProfile";
import { getCurrentPosition, reverseGeocode } from "../lib/weather";

type Props = {
  onContinue: () => void;
};

export function OnboardingProfileStep({ onContinue }: Props) {
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
  const [locationDenied, setLocationDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
    if (!file) return;
    try {
      const blob = await compressAvatar(file);
      const dataUrl = await blobToDataUrl(blob);
      setAvatarDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not use that photo.");
    }
  }

  async function allowLocation() {
    setLocating(true);
    setError("");
    setSaved(false);
    setLocationDenied(false);
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
      setLocationDenied(true);
      setError("Location access was declined. Enter your city and state below instead.");
    } finally {
      setLocating(false);
    }
  }

  function pickHit(hit: GeocodeHit) {
    setLocation(hit);
    setQuery(hit.place);
    setHits([]);
    setSaved(false);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setSaving(false);
      setError("First name and last name are required.");
      return;
    }
    if (!location) {
      setSaving(false);
      setError("Choose a location to personalize local safety resources, time, and weather.");
      return;
    }
    try {
      await saveLocalProfile({
        firstName: first,
        lastName: last,
        avatarDataUrl,
        location,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const previewName = composeDisplayName(firstName, lastName) || "Your name";

  return (
    <div
      className="onboarding-welcome-card onboarding-profile-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-profile-title"
    >
      <p className="eyebrow">Get started</p>
      <h2 id="onboarding-profile-title">Welcome to SafetyPrepList!</h2>
      <p className="onboarding-copy">Let&apos;s personalize your preparedness checklist.</p>

      <form className="onboarding-profile-form" onSubmit={onSave}>
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
                  setSaved(false);
                }}
              >
                Remove photo
              </button>
            ) : (
              <p className="muted">Optional profile picture</p>
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
              onChange={(event) => {
                setFirstName(event.target.value);
                setSaved(false);
              }}
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
              onChange={(event) => {
                setLastName(event.target.value);
                setSaved(false);
              }}
              placeholder="Doe"
              autoComplete="family-name"
              maxLength={40}
              required
            />
          </label>
        </div>

        <div className="onboarding-location-callout">
          <p>
            <strong>Allow location access</strong> for the best experience. Location helps personalize local safety
            resources, time, and weather on this device.
          </p>
          <button className="btn btn-ghost" type="button" disabled={locating} onClick={() => void allowLocation()}>
            {locating ? "Locating…" : "Allow location access"}
          </button>
          {locationDenied ? (
            <p className="muted">No problem — enter your city and state below instead.</p>
          ) : (
            <p className="muted">If you prefer not to share precise location, you can enter a city and state.</p>
          )}
        </div>

        <div className="account-field">
          <span>Location</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (location) setLocation(null);
              setSaved(false);
            }}
            placeholder="City, State"
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
          {location ? <p className="muted">Using {location.place}.</p> : null}
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {saved ? <p className="form-success">Profile saved on this device.</p> : null}

        <div className="onboarding-actions onboarding-actions-stacked">
          {!saved ? (
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={onContinue}>
              Continue
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
