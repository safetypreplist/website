import { FormEvent, useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useApp } from "../context/AppContext";
import { blobToDataUrl, compressAvatar } from "../lib/avatar";
import {
  composeDisplayName,
  isValidProfileEmail,
  searchPlaces,
  type GeocodeHit,
  type LocalProfileLocation,
} from "../lib/localProfile";
import { locateDevice, lookupIpLocation } from "../lib/weather";

export function ProfilePage() {
  const { localProfile, saveLocalProfile } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(localProfile.firstName);
  const [lastName, setLastName] = useState(localProfile.lastName);
  const [email, setEmail] = useState(localProfile.email || "");
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
    setEmail(localProfile.email || "");
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
      let next: LocalProfileLocation;
      try {
        next = await locateDevice();
      } catch {
        next = await lookupIpLocation();
      }
      setLocation(next);
      setQuery(next.place);
      setHits([]);
    } catch {
      setError("Could not read your current location. Search for a city or ZIP instead.");
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
    if (!isValidProfileEmail(email)) {
      setSaving(false);
      setError("Enter a valid email for invites and receipts. This is not a login.");
      return;
    }
    if (!location && query.trim()) {
      setSaving(false);
      setError("Pick a place from the list, or clear the location field.");
      return;
    }
    try {
      await saveLocalProfile({
        firstName: first,
        lastName: last,
        email,
        avatarDataUrl,
        location,
        locationSkipped: !location,
      });
      setMessage("Profile saved on this device. Email is attached to your license for invites and receipts — not a login.");
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
        Photo, name, email, and location stay on this device. Email attaches to your license for invites and receipts —
        there is no login account. Offline access continues here. Changing devices? Use Move to a new
        device. Lost your key? Use Forgot your key on the Activate page.
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

        <label className="account-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={120}
            required
          />
          <p className="muted">Used for Group Sharing invites and purchase recovery — not a password login.</p>
        </label>

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
          {location ? (
            <p className="muted">Weather will use {location.place}.</p>
          ) : (
            <p className="muted">Optional. Add a location for local time, weather, and safety resources.</p>
          )}
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
