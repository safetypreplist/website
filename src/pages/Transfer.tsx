import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { clearLocalLicense, getLicense } from "../lib/licenseClient";
import { PHOTO_LIBRARY } from "../lib/photos";
import { invokeFunction } from "../lib/supabase";

type ConfirmState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "success"; licenseKey: string }
  | { status: "error"; message: string };

export function TransferPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => (params.get("confirm") || "").trim(), [params]);
  const [confirm, setConfirm] = useState<ConfirmState>(token ? { status: "working" } : { status: "idle" });

  useEffect(() => {
    if (!token) return;
    let live = true;
    void (async () => {
      try {
        const data = await invokeFunction<{ ok?: boolean; deactivated?: boolean; licenseKey?: string }>(
          "confirm-deactivate-license",
          { token },
        );
        if (!live) return;
        if (!data?.deactivated || !data.licenseKey) {
          setConfirm({ status: "error", message: "That confirmation link is not valid or has expired." });
          return;
        }
        const local = getLicense();
        if (local && local.key.toUpperCase() === data.licenseKey.toUpperCase()) {
          clearLocalLicense();
        }
        setConfirm({ status: "success", licenseKey: data.licenseKey });
      } catch (err) {
        if (!live) return;
        setConfirm({
          status: "error",
          message: err instanceof Error ? err.message : "That confirmation link is not valid or has expired.",
        });
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  const showSuccess = confirm.status === "success";

  return (
    <div className="checkout-stage license-gate">
      <div
        className="checkout-bg license-gate-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <main className="license-gate-shell">
        <section className="license-gate-panel">
          <BrandMark className="brand-mark license-gate-mark" />
          <p className="eyebrow">Transfer</p>

          {confirm.status === "working" ? (
            <>
              <h1>Confirming deactivation…</h1>
              <p className="license-gate-lead">Please wait while we verify your email confirmation link.</p>
            </>
          ) : null}

          {confirm.status === "error" ? (
            <>
              <h1>Confirmation needed</h1>
              <p className="form-error" role="alert">
                {confirm.message}
              </p>
              <p className="license-gate-lead">
                Request a new confirmation from the deactivation page, or follow the general transfer steps below.
              </p>
              <Link className="btn btn-primary" to="/deactivate">
                Back to Deactivate
              </Link>
            </>
          ) : null}

          {showSuccess ? (
            <div className="license-gate-success" role="status">
              <p className="eyebrow">Done</p>
              <h1>Your license has been deactivated successfully!</h1>
              <p className="muted">Your license is now available to activate on your new device.</p>
            </div>
          ) : null}

          {confirm.status === "idle" || showSuccess || confirm.status === "error" ? (
            <>
              {!showSuccess && confirm.status === "idle" ? (
                <>
                  <h1>Move Safety Prep List to a new device</h1>
                  <p className="license-gate-lead">
                    Use these steps after you back up your data and free your license. Activation and data transfer stay
                    separate.
                  </p>
                </>
              ) : null}

              <ol className="license-transfer-steps">
                <li>Install or open Safety Prep List on your new device.</li>
                <li>
                  Open <Link to="/activate">License Activation</Link>
                  {showSuccess ? " and enter your existing license key." : " and enter your license key."}
                </li>
                <li>Activate your license on the new device.</li>
                <li>
                  Open <strong>Transfer My Data</strong> (under License in the app).
                </li>
                <li>Import from SafetyPrepList Cloud or import your backup file.</li>
              </ol>

              {showSuccess ? (
                <div className="license-gate-actions">
                  <Link
                    className="btn btn-primary"
                    to={`/activate?key=${encodeURIComponent(confirm.licenseKey)}&reason=released`}
                  >
                    Activate on this device
                  </Link>
                  <Link className="btn btn-ghost" to="/app/transfer">
                    Transfer My Data
                  </Link>
                </div>
              ) : (
                <div className="license-gate-actions">
                  <Link className="btn btn-primary" to="/activate">
                    Open Activate
                  </Link>
                  <Link className="btn btn-ghost" to="/deactivate">
                    Deactivate &amp; transfer
                  </Link>
                </div>
              )}

              <p className="muted" style={{ marginTop: 18 }}>
                A device that is offline may still open its local copy until it reconnects and checks license status.
                Temporary cloud backups expire after 48 hours.
              </p>
            </>
          ) : null}
        </section>
        <p className="muted license-gate-foot">
          <Link to="/activate">Activate</Link>
          {" · "}
          <Link to="/license">License details</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
