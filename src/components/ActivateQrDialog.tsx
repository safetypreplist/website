import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function activateUrlForKey(licenseKey: string) {
  const origin = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
  return `${origin}/activate?key=${encodeURIComponent(licenseKey)}`;
}

export function useActivateQr(licenseKey: string, size = 280) {
  const activateUrl = activateUrlForKey(licenseKey);
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

/** Compact QR shown inside Transfer Step 3. */
export function ActivateQrInline({ licenseKey, onExpand }: { licenseKey: string; onExpand: () => void }) {
  const { qrSrc, error } = useActivateQr(licenseKey, 168);

  return (
    <button className="activate-qr-inline" type="button" onClick={onExpand} aria-label="Show larger QR code to activate on phone or tablet">
      <span className="activate-qr-inline-label">Need your phone?</span>
      <span className="activate-qr-inline-frame">
        {qrSrc ? (
          <img src={qrSrc} width={168} height={168} alt="" />
        ) : error ? (
          <span className="muted">Tap to open QR</span>
        ) : (
          <span className="muted">…</span>
        )}
      </span>
      <span className="activate-qr-inline-cta">Scan to activate</span>
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
        <p className="eyebrow">Activate on phone or tablet</p>
        <h2 id="activate-qr-title">Scan this QR code</h2>
        <p className="muted activate-qr-lead">
          Point your phone or tablet camera at the code. It opens Activate with your license key ready to go.
        </p>

        <div className="activate-qr-frame">
          {qrSrc ? (
            <img src={qrSrc} width={280} height={280} alt="QR code that opens Activate with your license key" />
          ) : error ? (
            <p className="form-error" role="alert">
              {error} Use the link below instead.
            </p>
          ) : (
            <p className="muted">Preparing QR code…</p>
          )}
        </div>

        <p className="activate-qr-hint muted">
          Or open this link on the new device:
          <br />
          <a href={activateUrl}>{activateUrl}</a>
        </p>
      </div>
    </div>
  );
}
