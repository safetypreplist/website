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
  const [error, setError] = useState("");

  useEffect(() => {
    setFirstName(localProfile.firstName);
    setLastName(localProfile.lastName);
    setAvatarDataUrl(localProfile.avatarDataUrl);
    setLocation(localProfile.location);
    setQuery(localProfile.location?.place || "");
  }, [localProfile]);

  useEffect(() => {
    if (!locationDenied) {
      setHits([]);
      return;
    }
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
  }, [query, location, locationDenied]);

  async function onPickPhoto(file: File | null) {
    setError("");
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
      setError("");
    } finally {
      setLocating(false);
    }
  }

  function pickHit(hit: GeocodeHit) {
    setLocation(hit);
    setQuery(hit.place);
    setHits([]);
  }

  async function onSubmit(event: FormEvent) {
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
      setError(
        locationDenied
          ? "Enter your city and state to continue."
          : "Allow location access to personalize safety resources, time, and weather.",
      );
      return;
    }
    try {
      await saveLocalProfile({
        firstName: first,
        lastName: last,
        avatarDataUrl,
        location,
      });
      onContinue();
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
      <div className="onboarding-profile-hero">
        <p className="eyebrow">You&apos;re in</p>
        <h2 id="onboarding-profile-title">Welcome to SafetyPrepList!</h2>
        <p className="onboarding-copy">Let&apos;s personalize your preparedness checklist.</p>
      </div>

      <form className="onboarding-profile-form" onSubmit={onSubmit}>
        <div className="onboarding-profile-layout">
          <div className="onboarding-profile-step-photo">
            <button
              className="onboarding-profile-avatar-btn"
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={avatarDataUrl ? "Change photo" : "Add photo"}
            >
              <ProfileAvatar className="onboarding-profile-avatar" name={previewName} avatarUrl={avatarDataUrl} />
            </button>
            <button
              className="onboarding-profile-photo-action"
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              {avatarDataUrl ? "Change photo" : "Add photo"}
            </button>
            {avatarDataUrl ? (
              <button
                className="onboarding-profile-photo-remove"
                type="button"
                onClick={() => setAvatarDataUrl(null)}
              >
                Remove
              </button>
            ) : null}
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

          <div className="onboarding-profile-fields">
            <div className="profile-name-grid">
              <label className="account-field">
                <span className="sr-only">First name</span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                  maxLength={40}
                  required
                />
              </label>
              <label className="account-field">
                <span className="sr-only">Last name</span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                  maxLength={40}
                  required
                />
              </label>
            </div>

            <div className="onboarding-location-block">
              {location && !locationDenied ? (
                <div className="onboarding-location-ready" role="status">
                  <span className="onboarding-location-check" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <strong>Location ready</strong>
                    <p>{location.place}</p>
                  </div>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={locating}
                    onClick={() => void allowLocation()}
                  >
                    {locating ? "Updating…" : "Update"}
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost onboarding-location-cta"
                  type="button"
                  disabled={locating}
                  onClick={() => void allowLocation()}
                >
                  {locating ? "Locating…" : "Allow location access"}
                </button>
              )}
              {!location && !locationDenied ? (
                <p className="muted onboarding-location-hint">
                  Powers local safety resources, time, and weather on this device.
                </p>
              ) : null}
            </div>

            {locationDenied ? (
              <div className="onboarding-location-fallback">
                <p className="muted">No problem — enter your city and state instead.</p>
                <label className="account-field">
                  <span className="sr-only">City, State</span>
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      if (location) setLocation(null);
                    }}
                    placeholder="City, State"
                    autoComplete="address-level2"
                    required
                  />
                </label>
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
            ) : null}
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="onboarding-actions onboarding-actions-stacked">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
