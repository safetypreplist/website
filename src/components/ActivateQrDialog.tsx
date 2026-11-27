import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { moveLinkForKey } from "../lib/moveLicense";

const PHONE_QUERY = "(max-width: 760px), (pointer: coarse)";

/** Phones and tablets: showing a QR "for your phone" there makes no sense. */
export function usePhoneLike() {
  const [phoneLike, setPhoneLike] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE_QUERY);
    const sync = () => setPhoneLike(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return phoneLike;
}

export function useActivateQr(licenseKey: string, size = 280) {
  const activateUrl = moveLinkForKey(licenseKey);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    setQrSrc(null);
    void QRCode.toDataURL(activateUrl, {
      width: size,
      margin: 2,
      color: { dark: "#14211b", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (live) setQrSrc(dataUrl);
      })
      .catch(() => {
        if (live) setError("Could not create that QR code.");
      });
    return () => {
      live = false;
    };
  }, [activateUrl, size]);

  return { activateUrl, qrSrc, error };
}

/** QR shown on the old device once the license is ready to move. */
export function ActivateQrInline({ licenseKey, onExpand }: { licenseKey: string; onExpand: () => void }) {
  const { qrSrc, error } = useActivateQr(licenseKey, 200);

  return (
    <button className="activate-qr-inline" type="button" onClick={onExpand} aria-label="Show a larger QR code">
      <span className="activate-qr-inline-frame">
        {qrSrc ? (
          <img src={qrSrc} width={200} height={200} alt="QR code that opens Safety Prep List with your license key" />
        ) : error ? (
          <span className="muted">Tap to open the link</span>
        ) : (
          <span className="muted">…</span>
        )}
      </span>
      <span className="activate-qr-inline-cta">Scan with your phone&apos;s camera</span>
    </button>
  );
}

export function ActivateQrDialog({ licenseKey, onClose }: { licenseKey: string; onClose: () => void }) {
  const { activateUrl, qrSrc, error } = useActivateQr(licenseKey, 280);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-panel sheet-panel activate-qr-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activate-qr-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <p className="eyebrow">Use it on your phone</p>
        <h2 id="activate-qr-title">Scan this code</h2>
        <p className="muted activate-qr-lead">
          Point your phone&apos;s camera at the code. Safety Prep List opens with your key filled in — tap Activate.
        </p>

        <div className="activate-qr-frame">
          {qrSrc ? (
            <img src={qrSrc} width={280} height={280} alt="QR code that opens Safety Prep List with your license key" />
          ) : error ? (
            <p className="form-error" role="alert">
              {error} Use the link below instead.
            </p>
          ) : (
            <p className="muted">Preparing QR code…</p>
          )}
        </div>

        <p className="activate-qr-hint muted">
          Or open this link on your phone:
          <br />
          <a href={activateUrl}>{activateUrl}</a>
        </p>
      </div>
    </div>
  );
}
