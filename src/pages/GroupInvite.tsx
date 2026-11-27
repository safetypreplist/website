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

const STATUS_COPY: Record<Exclude<GroupInviteStatus, "pending">, string> = {
  accepted: "You've accepted this invitation.",
  declined: "This invitation was declined.",
  expired: "This invitation has expired because the Group Sharing session ended.",
  revoked: "The host withdrew this invitation.",
};

export function GroupInvitePage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wrongDevice, setWrongDevice] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<GroupInviteStatus | null>(null);
  const [groupName, setGroupName] = useState("Group Sharing");
  const [hostName, setHostName] = useState("Host");
  const [permission, setPermission] = useState<GroupPermission>("view");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
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
        setExpiresAt(data.expiresAt || null);
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
      if (message.toLowerCase().includes("device verification required")) {
        setWrongDevice(true);
      } else {
        setError(message);
      }
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
              <div className="group-wrong-device" role="alert">
                <h2>Device verification required</h2>
                <p>
                  This invitation was sent to a different Safety Prep List license, or this device isn&apos;t the one
                  where the invited license is activated. Open the link on that device — email links alone cannot grant
                  access.
                </p>
                <p className="muted">
                  If the invite was sent to the email on your license, you can also find it under Group Sharing in the
                  app on your licensed device.
                </p>
                <div className="license-manage-actions" style={{ gap: 10 }}>
                  {licensed ? (
                    <Link className="btn btn-primary" to="/app/group-sharing">
                      Open Group Sharing
                    </Link>
                  ) : null}
                  <Link className={`btn ${licensed ? "btn-ghost" : "btn-primary"}`} to="/activate">
                    Go to Activate
                  </Link>
                </div>
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
                  {expiresAt ? (
                    <div>
                      <dt>Group ends</dt>
                      <dd>{new Date(expiresAt).toLocaleString()}</dd>
                    </div>
                  ) : null}
                </dl>
                {!licensed ? (
                  <p className="muted">
                    Activate your own license on this device first.{" "}
                    <Link to={`/activate`}>Open Activate</Link>
                  </p>
                ) : (
                  <>
                    <ul className="group-sharing-ticks">
                      <li>
                        {permission === "edit"
                          ? "You'll be able to check items and edit notes on other members' shared checklists."
                          : "You'll be able to see other members' shared checklists, but not change them."}
                      </li>
                      <li>While you're in the group, your checklist progress and notes are shared with its members.</li>
                      <li>
                        Members with Edit permission can change your shared checklist, and those changes sync to this
                        device.
                      </li>
                      <li>You can leave at any time. Your own checklist and license stay on this device.</li>
                    </ul>
                    <label className="group-consent-line">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span>I understand and want to share my checklist with this group.</span>
                    </label>
                    <div className="license-manage-actions" style={{ gap: 10 }}>
                      <button
                        className="btn btn-primary"
                        type="button"
                        disabled={busy || !consent}
                        onClick={() => void respond(true)}
                      >
                        {busy ? "Working…" : "Accept invitation"}
                      </button>
                      <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void respond(false)}>
                        Decline
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : null}

            {!loading && inviteStatus && inviteStatus !== "pending" ? (
              <div role="status">
                <p>
                  <strong>{STATUS_COPY[inviteStatus]}</strong>
                </p>
                {inviteStatus === "accepted" ? (
                  <Link className="btn btn-primary" to="/app/group-sharing">
                    Open Group Sharing
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
