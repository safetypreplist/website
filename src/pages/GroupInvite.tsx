import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import {
  previewInvite,
  respondToInvite,
  type GroupInviteStatus,
  type GroupPermission,
} from "../lib/groupSharing";
import { getLicense, isLicensed } from "../lib/licenseClient";
import { PHOTO_LIBRARY } from "../lib/photos";

export function GroupInvitePage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wrongDevice, setWrongDevice] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<GroupInviteStatus | null>(null);
  const [groupName, setGroupName] = useState("Group Sharing");
  const [hostName, setHostName] = useState("Host");
  const [permission, setPermission] = useState<GroupPermission>("view");
  const [busy, setBusy] = useState(false);
  const licensed = isLicensed();

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const data = await previewInvite(token);
        if (!live) return;
        setInviteStatus(data.inviteStatus);
        if (data.groupName) setGroupName(data.groupName);
        if (data.hostName) setHostName(data.hostName);
        if (data.permission) setPermission(data.permission);
      } catch (err) {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Could not load that invitation.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    setWrongDevice(false);
    try {
      if (!isLicensed() || !getLicense()?.key) {
        setError("Activate your license on this device first, then open this invitation again.");
        setBusy(false);
        return;
      }
      const data = await respondToInvite(token, accept);
      setInviteStatus(data.inviteStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update that invitation.";
      if (message.toLowerCase().includes("device") || message.toLowerCase().includes("email")) {
        setWrongDevice(true);
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-stage license-gate">
      <div
        className="checkout-bg license-gate-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <main>
        <div className="license-manage">
          <header className="license-manage-hero">
            <p className="eyebrow">Group Sharing</p>
            <h1>Accept Group Invitation</h1>
            <p className="license-manage-lead">
              Invitations are never granted automatically. You must confirm on the device where your license is
              activated.
            </p>
          </header>

          <section className="license-manage-card">
            {loading ? <p className="muted">Loading invitation…</p> : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            {wrongDevice ? (
              <div className="group-wrong-device">
                <h2>Open this on your licensed device</h2>
                <p>
                  This invitation stays pending until you accept it from the device where the matching Safety Prep List
                  license is activated. Email links alone cannot grant access.
                </p>
                <Link className="btn btn-primary" to="/activate">
                  Go to Activate
                </Link>
              </div>
            ) : null}

            {!loading && inviteStatus === "pending" && !wrongDevice ? (
              <>
                <dl className="license-manage-facts">
                  <div>
                    <dt>Group</dt>
                    <dd>{groupName}</dd>
                  </div>
                  <div>
                    <dt>Host</dt>
                    <dd>{hostName}</dd>
                  </div>
                  <div>
                    <dt>Permission offered</dt>
                    <dd>{permission === "edit" ? "Edit" : "View only"}</dd>
                  </div>
                </dl>
                {!licensed ? (
                  <p className="muted">
                    Activate your own license on this device first.{" "}
                    <Link to={`/activate`}>Open Activate</Link>
                  </p>
                ) : (
                  <div className="license-manage-actions" style={{ gap: 10 }}>
                    <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void respond(true)}>
                      {busy ? "Working…" : "Accept invitation"}
                    </button>
                    <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void respond(false)}>
                      Decline
                    </button>
                  </div>
                )}
              </>
            ) : null}

            {!loading && inviteStatus && inviteStatus !== "pending" ? (
              <p>
                Invitation status: <strong>{inviteStatus}</strong>
                {inviteStatus === "accepted" ? (
                  <>
                    {" "}
                    <Link to="/app/group-sharing">Open Group Sharing</Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
