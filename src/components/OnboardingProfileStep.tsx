import { FormEvent, useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "./ProfileAvatar";
import { useApp } from "../context/AppContext";
import { blobToDataUrl, compressAvatar } from "../lib/avatar";
import {
  composeDisplayName,
  isValidProfileEmail,
  lookupZipCode,
  normalizeZipCode,
  splitFullName,
  type LocalProfileLocation,
} from "../lib/localProfile";
import {
  getCurrentPosition,
  isGeolocationPermissionDenied,
  lookupIpLocation,
  reverseGeocode,
} from "../lib/weather";

type Props = {
  onContinue: () => void;
};

export function OnboardingProfileStep({ onContinue }: Props) {
  const { localProfile, saveLocalProfile } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(composeDisplayName(localProfile.firstName, localProfile.lastName));
  const [email, setEmail] = useState(localProfile.email || "");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(localProfile.avatarDataUrl);
  const [location, setLocation] = useState<LocalProfileLocation | null>(localProfile.location);
  const [zip, setZip] = useState("");
  const [lookingUpZip, setLookingUpZip] = useState(false);
  const [locating, setLocating] = useState(false);
  const [needsZip, setNeedsZip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFullName(composeDisplayName(localProfile.firstName, localProfile.lastName));
    setEmail(localProfile.email || "");
    setAvatarDataUrl(localProfile.avatarDataUrl);
    setLocation(localProfile.location);
  }, [localProfile]);

  useEffect(() => {
    if (!needsZip) return;
    const code = normalizeZipCode(zip);
    if (code.length !== 5) {
      setLookingUpZip(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLookingUpZip(true);
      setError("");
      void lookupZipCode(code)
        .then((hit) => {
          if (cancelled) return;
          setLocation(hit);
        })
        .catch((err) => {
          if (cancelled) return;
          setLocation(null);
          setError(err instanceof Error ? err.message : "Could not find that ZIP code.");
        })
        .finally(() => {
          if (!cancelled) setLookingUpZip(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [zip, needsZip]);

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
    setNeedsZip(false);
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const geo = await reverseGeocode(lat, lon);
      setLocation({
        place: geo.place,
        lat,
        lon,
        stateCode: geo.stateCode,
      });
      setZip("");
    } catch (err) {
      if (!isGeolocationPermissionDenied(err)) {
        try {
          const ip = await lookupIpLocation();
          setLocation({
            place: ip.place,
            lat: ip.lat,
            lon: ip.lon,
            stateCode: ip.stateCode,
          });
          setZip("");
          return;
        } catch {
          /* show ZIP fallback below */
        }
      }
      setNeedsZip(true);
      setLocation(null);
      setError(
        isGeolocationPermissionDenied(err)
          ? "Location permission was blocked for this site. Enter your ZIP code, or turn location back on in your browser settings and try again."
          : "Could not get your location. Enter your ZIP code instead.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const { firstName, lastName } = splitFullName(fullName);
    if (!composeDisplayName(firstName, lastName)) {
      setSaving(false);
      setError("Enter your full name to continue.");
      return;
    }
    if (!isValidProfileEmail(email)) {
      setSaving(false);
      setError("Enter an email for invites and receipts. This is not a login account.");
      return;
    }

    let nextLocation = location;
    if (!nextLocation && needsZip) {
      const code = normalizeZipCode(zip);
      if (code.length === 5) {
        try {
          nextLocation = await lookupZipCode(code);
          setLocation(nextLocation);
        } catch (err) {
          setSaving(false);
          setError(err instanceof Error ? err.message : "Enter a valid ZIP code to continue.");
          return;
        }
      }
    }

    if (!nextLocation) {
      setSaving(false);
      setError(
        needsZip
          ? "Enter your ZIP code to continue."
          : "Allow location access to personalize safety resources, time, and weather.",
      );
      return;
    }

    try {
      await saveLocalProfile({
        firstName,
        lastName,
        email,
        avatarDataUrl,
        location: nextLocation,
      });
      onContinue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const previewName = fullName.trim() || "Your name";

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
              {avatarDataUrl ? (
                <ProfileAvatar className="onboarding-profile-avatar" name={previewName} avatarUrl={avatarDataUrl} />
              ) : (
                <span className="onboarding-profile-avatar onboarding-profile-avatar-empty" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 8.5h2.2l1.1-2h8.4l1.1 2H19.5A1.5 1.5 0 0 1 21 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V10a1.5 1.5 0 0 1 1.5-1.5Z" />
                    <circle cx="12" cy="14" r="3.25" />
                  </svg>
                </span>
              )}
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
            <label className="account-field">
              <span>Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
            </label>

            <label className="account-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={120}
                required
              />
              <p className="muted onboarding-location-hint">
                For invites and receipts only — not a login. Offline access stays on this device. If you lose this
                browser, use Transfer / Deactivate or Recover My License.
              </p>
            </label>

            <div className="onboarding-location-block">
              <span className="onboarding-profile-field-label">Location</span>
              {location && !needsZip ? (
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
              {!location && !needsZip ? (
                <p className="muted onboarding-location-hint">
                  Powers local safety resources, time, and weather on this device.
                </p>
              ) : null}
            </div>

            {needsZip ? (
              <label className="account-field">
                <span>ZIP code</span>
                <input
                  value={zip}
                  onChange={(event) => {
                    const next = event.target.value.replace(/[^\d-]/g, "").slice(0, 10);
                    setZip(next);
                    setLocation(null);
                    setError("");
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  required
                />
                {lookingUpZip ? <p className="muted onboarding-location-hint">Looking up ZIP…</p> : null}
                {location && !lookingUpZip ? (
                  <p className="muted onboarding-location-hint">Using {location.place}.</p>
                ) : null}
              </label>
            ) : null}
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="onboarding-actions onboarding-actions-stacked">
          <button className="btn btn-primary" type="submit" disabled={saving || locating || lookingUpZip}>
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
