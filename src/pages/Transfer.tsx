import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { clearLocalLicense, getLicense, isLicensed } from "../lib/licenseClient";
import { keyFromLocation, takeEmailMoveRequest } from "../lib/moveLicense";
import { PHOTO_LIBRARY } from "../lib/photos";
import { invokeFunction } from "../lib/supabase";
import type { ActivateRouteState } from "./Activate";

type ConfirmState =
  | { status: "working" }
  | { status: "success"; licenseKey: string }
  | { status: "error"; message: string };

const EXPIRED = "This link has expired or was already used.";

// One request per token, even if the page mounts twice.
const confirmations = new Map<string, Promise<string>>();

function confirmMove(token: string) {
  let pending = confirmations.get(token);
  if (!pending) {
    pending = invokeFunction<{ deactivated?: boolean; licenseKey?: string }>("confirm-deactivate-license", { token }).then(
      (data) => {
        if (!data?.deactivated || !data.licenseKey) throw new Error(EXPIRED);
        return data.licenseKey;
      },
    );
    confirmations.set(token, pending);
  }
  return pending;
}

/** Old /deactivate and /transfer links land in the one Move flow. */
export function MoveRedirect() {
  const location = useLocation();
  if (isLicensed()) return <Navigate to="/app/transfer" replace />;
  const key = keyFromLocation(location.search, location.hash);
  return <Navigate to={key ? `/activate#key=${encodeURIComponent(key)}` : "/activate"} replace />;
}

/** `/transfer?confirm=<token>` — the one-time link emailed when the old device can't be used. */
export function TransferPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => (params.get("confirm") || "").trim(), [params]);
  const [confirm, setConfirm] = useState<ConfirmState>({ status: "working" });

  useEffect(() => {
    if (!token) return;
    void confirmMove(token)
      .then((licenseKey) => {
        const local = getLicense();
        if (local && local.key.toUpperCase() === licenseKey.toUpperCase()) clearLocalLicense();
        if (takeEmailMoveRequest(licenseKey)) {
          const state: ActivateRouteState = { autoActivateKey: licenseKey };
          navigate("/activate", { replace: true, state });
          return;
        }
        setConfirm({ status: "success", licenseKey });
      })
      .catch((err) => {
        setConfirm({ status: "error", message: err instanceof Error && err.message ? err.message : EXPIRED });
      });
  }, [navigate, token]);

  if (!token) return <MoveRedirect />;

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
          <p className="eyebrow">Move to a new device</p>

          {confirm.status === "working" ? (
            <>
              <h1>Moving your license…</h1>
              <p className="license-gate-lead">Checking your email link.</p>
            </>
          ) : null}

          {confirm.status === "error" ? (
            <>
              <h1>This link can&apos;t be used</h1>
              <p className="form-error" role="alert">
                {confirm.message}
              </p>
              <p className="license-gate-lead">
                Enter your key on the device you want to use and ask for a new link there.
              </p>
              <Link className="btn btn-primary" to="/activate">
                Go to Activate
              </Link>
            </>
          ) : null}

          {confirm.status === "success" ? (
            <>
              <h1>Your license is ready to move</h1>
              <p className="license-gate-lead">
                It is no longer tied to your old device. Use it here, or open safetypreplist.com/activate on the
                device you want and enter your key.
              </p>
              <div className="license-gate-actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    const state: ActivateRouteState = { autoActivateKey: confirm.licenseKey };
                    navigate("/activate", { state });
                  }}
                >
                  Use it on this device
                </button>
              </div>
            </>
          ) : null}
        </section>
        <p className="muted license-gate-foot">
          <Link to="/license-recovery">Forgot your key?</Link>
          {" · "}
          <Link to="/contact">Contact us</Link>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
