import { Link, Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { formatDate } from "../lib/format";

export function accessHasEnded(endsAt?: string | null) {
  return Boolean(endsAt) && Date.parse(endsAt as string) < Date.now();
}

export function AccessEndedPage() {
  const { user, profile, myChecklist, connectedChecklists, accessMode, loading } = useApp();
  if (!loading && accessMode === "full" && profile?.access_status !== "expired") return <Navigate to="/app" replace />;
  const payer = !myChecklist?.purchasedByUserId || myChecklist.purchasedByUserId === user?.id;
  const seats = 1 + connectedChecklists.filter((c) => c.purchasedByUserId === user?.id).length;
  const access = profile?.access_interval === "annual" ? "annual" : "monthly";
  const renewHref = `/checkout?renew=1&plan=${seats > 1 ? "family" : "individual"}&qty=${seats}&access=${access}`;
  const endedOn = myChecklist?.accessEndsAt ? formatDate(myChecklist.accessEndsAt) : null;

  return (
    <div className="locked-panel">
      <p className="eyebrow">Access ended</p>
      <h2>{endedOn ? `Your Safety Prep List access ended on ${endedOn}.` : "Your Safety Prep List access has ended."}</h2>
      {payer ? (
        <>
          <p className="muted">
            Your checklists, notes, and contacts are saved. Renew to pick up where you left off.
            {profile?.access_status === "past_due"
              ? " If a payment failed, you can also update your payment method in Billing."
              : ""}
          </p>
          <Link className="btn btn-primary" to={renewHref}>
            Renew my plan
          </Link>
        </>
      ) : (
        <p className="muted">
          The Family Plan that covers your checklist has ended. Your checklist is saved. Ask the person who manages
          your Family Plan to renew it.
        </p>
      )}
      <p className="muted" style={{ marginTop: 16 }}>
        <Link to="/app/account">Account</Link> · <Link to="/app/help">Help</Link>
      </p>
    </div>
  );
}
