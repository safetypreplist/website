import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AccessChoice, type AccessLevel } from "../components/AccessChoice";
import { BrandMark } from "../components/Brand";
import {
  FamilyMemberRows,
  FamilyRowMessage,
  FamilySeatSetup,
  emptyFamilyRows,
  familyRowsError,
  loadOpenFamilySeats,
  sendFamilyInvites,
  type FamilyRow,
  type FamilyRowResult,
} from "../components/FamilySeatSetup";
import { LegalAgreement } from "../components/LegalAgreement";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import { recordLegalAcceptance } from "../lib/legalConsent";
import { useApp } from "../context/AppContext";
import { countAllOps, takeSignedOutReason } from "../lib/offlineStore";
import { invokeFunction, supabase } from "../lib/supabase";
import { PRODUCT_CODE_RE } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import { CheckoutProgress } from "./Purchase";

function PasswordField({
  value,
  onChange,
  autoComplete,
  hint,
  minLength = 8,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>Password</span>
      <div className="password-field">
        <input
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

function Card({
  title,
  children,
  progress,
}: {
  title: string;
  children: React.ReactNode;
  progress?: number;
}) {
  return (
    <div className="checkout-stage">
      <div
        className="checkout-bg"
        style={{ backgroundImage: `url(${PHOTO_LIBRARY.landscape})` }}
        aria-hidden="true"
      />
      <PublicHeader />
      <div className="auth-card">
        {progress != null ? <CheckoutProgress current={progress} /> : null}
        <BrandMark />
        <p className="eyebrow" style={{ marginTop: 16 }}>Safety Prep List</p>
        <h1>{title}</h1>
        {children}
      </div>
      <PublicFooter />
    </div>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const { signIn, session, profile, loading } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedOutReason] = useState(takeSignedOutReason);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    void countAllOps().then(setWaiting);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await signIn(email, password);
      navigate(result.role === "owner" ? "/admin" : "/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setSubmitting(false);
    }
  }

  if (!loading && session && !submitting) {
    return <Navigate to={profile?.role === "owner" ? "/admin" : "/app"} replace />;
  }

  return (
    <Card title="Sign in">
      {signedOutReason === "device_removed" ? (
        <p className="form-note">
          This device was removed from your account, so it was signed out. Sign in again to use it here. Your other
          devices are still signed in.
        </p>
      ) : null}
      {waiting ? (
        <p className="form-note">
          {waiting === 1 ? "1 checklist change is" : `${waiting} checklist changes are`} still saved on this device.
          {waiting === 1 ? " It syncs" : " They sync"} after you sign in with the same account.
        </p>
      ) : null}
      <form onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      <PasswordField value={password} onChange={setPassword} autoComplete="current-password" minLength={1} />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit">
          Sign In
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        <Link to="/reset-password">Forgot password?</Link>
        <br />
        New here? <Link to="/#pricing">Get Safety Prep List</Link>
      </p>
    </Card>
  );
}

export function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <Card title="Reset password">
      {sent ? (
        <p className="muted">If that email has an account, a reset link is on the way.</p>
      ) : (
        <form onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit">
            Send reset link
          </button>
        </form>
      )}
    </Card>
  );
}

export function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) setError(err.message);
    else navigate("/app");
  }

  return (
    <Card title="New password">
      <form onSubmit={onSubmit}>
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit">
          Save password
        </button>
      </form>
    </Card>
  );
}

export function CreateAccountPage() {
  const { demoMode, refreshAccount } = useApp();
  const [familySeats, setFamilySeats] = useState<string[]>([]);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stored = sessionStorage.getItem("spl.productCode") || "";
  const code = (params.get("code") || stored || (demoMode ? "RDM-7K4F-92LX" : "")).toUpperCase();
  const purchasedSeats = Math.floor(Number(params.get("qty") || sessionStorage.getItem("spl.familyQty") || "1")) || 1;
  const extraSeats = Math.max(0, Math.min(purchasedSeats, 20) - 1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<FamilyRow[]>(() => emptyFamilyRows(extraSeats));
  const [inviteResults, setInviteResults] = useState<Record<number, FamilyRowResult> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewNote, setPreviewNote] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const validCode = useMemo(() => PRODUCT_CODE_RE.test(code), [code]);

  async function onSubmit(e: FormEvent) {
    setSubmitting(true);
    try {
      await createAccounts(e);
    } finally {
      setSubmitting(false);
    }
  }

  async function createAccounts(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPreviewNote(false);
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    const memberProblem = familyRowsError(members, email);
    if (memberProblem) {
      setError(memberProblem);
      return;
    }
    if (demoMode) {
      await recordLegalAcceptance("signup", email);
      setPreviewNote(true);
      return;
    }
    if (validCode) {
      const { data: status } = await supabase.rpc("product_code_status", { p_code: code });
      if (status === "claimed") {
        setError(
          "This confirmation number is already linked to an account. Sign in to that account to see your checklist, or contact us if you think this is a mistake.",
        );
        return;
      }
      if (status === "unknown") {
        setError("We couldn’t find that confirmation number. Check it and try again, or contact us and we’ll help.");
        return;
      }
      if (status === "pending") {
        setError("Your payment is still being confirmed. Wait a minute, then try again.");
        return;
      }
    }
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, ...(validCode ? { product_code: code } : {}) },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    if (err) {
      setError(err.message);
      return;
    }
    await recordLegalAcceptance("signup", email);
    void invokeFunction("send-account-email", { name }).catch((err) => console.error("Account email failed", err));
    if (data.session) {
      sessionStorage.removeItem("spl.productCode");
      const seats = await loadOpenFamilySeats(data.session.user.id);
      if (members.some((row) => row.email.trim())) {
        setInviteResults(await sendFamilyInvites(seats, members));
        return;
      }
      if (seats.length && !members.length) {
        setFamilySeats(seats);
        return;
      }
      navigate("/app");
      return;
    }
    setError("Check your email to confirm the account, then sign in.");
  }

  if (inviteResults) {
    const sent = members
      .map((row, index) => ({ row, result: inviteResults[index] }))
      .filter((item) => item.result);
    const skipped = members.filter((row) => !row.email.trim()).length;
    return (
      <Card title="Your accounts are ready" progress={3}>
        <p className="family-setup-lead">
          Your account is set up. We emailed {sent.length === 1 ? "your family member" : "each family member"} a link to
          create their own account. Ask them to check their inbox (and spam folder).
        </p>
        {sent.map(({ row, result }) => (
          <div className="family-setup-row" key={row.email}>
            <p className="family-setup-name">{[row.first, row.last].filter(Boolean).join(" ")}</p>
            <FamilyRowMessage result={result} />
          </div>
        ))}
        {skipped > 0 ? (
          <p className="muted family-setup-note">
            You can add the {skipped === 1 ? "remaining person" : `remaining ${skipped} people`} anytime from Manage
            Family Plan.
          </p>
        ) : null}
        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          type="button"
          onClick={() => {
            void refreshAccount().finally(() => navigate("/app"));
          }}
        >
          Go to My Checklist
        </button>
      </Card>
    );
  }

  if (familySeats.length) {
    return (
      <Card title="Set up your family" progress={3}>
        <FamilySeatSetup
          seatIds={familySeats}
          onDone={() => {
            void refreshAccount().finally(() => navigate("/app"));
          }}
        />
      </Card>
    );
  }

  return (
      <Card title={extraSeats ? "Create your accounts" : "Create my account"} progress={2}>
      {validCode ? (
        <p className="purchase-ref" style={{ marginTop: 0, marginBottom: 8 }}>
          <span>Confirmation number</span>
          <code>{code}</code>
        </p>
      ) : null}
      <form onSubmit={onSubmit}>
        {extraSeats ? <h2 className="signup-section-title">Your account (primary, billing)</h2> : null}
        <label className="field">
          <span>Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        {extraSeats ? (
          <div className="signup-family">
            <h2 className="signup-section-title">Add your family {extraSeats === 1 ? "member" : "members"}</h2>
            <p className="field-hint">
              Your plan includes {extraSeats === 1 ? "1 more checklist" : `${extraSeats} more checklists`}. We'll email
              each person a link to create their own login. Leave a row blank to add them later.
            </p>
            <FamilyMemberRows rows={members} onChange={setMembers} disabled={submitting} />
          </div>
        ) : null}
        <LegalAgreement id="signup-agree" checked={agreed} onChange={setAgreed} />
        {error && <p className="form-error">{error}</p>}
        {previewNote && (
          <p className="muted" style={{ marginTop: 12 }}>
            This is a preview of the create-account screen. Cloud signup is not connected yet.{" "}
            <Link to="/signin">Sign in to demo</Link> to look inside the app.
          </p>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit" disabled={!agreed || submitting}>
          {submitting ? "Creating accounts…" : extraSeats ? "Create Accounts" : "Create My Account"}
        </button>
      </form>
    </Card>
  );
}

type InviteDetails = {
  status: "pending" | "accepted" | "cancelled" | "expired";
  invited_email: string | null;
  invited_first_name: string | null;
  inviter_name: string;
};

type InviteMember = { checklist_id: string; name: string; is_primary: boolean; has_account: boolean };

const INVITE_CLOSED: Record<string, string> = {
  accepted: "This invitation has already been used. If it was yours, sign in to see your checklist.",
  cancelled: "This invitation was canceled. Ask the person who invited you to send a new one.",
  expired: "This invitation has expired. Ask the person who invited you to resend it from their Family Plan page.",
  unknown: "We couldn't find this invitation. Check that you opened the full link from your email.",
};

export function JoinFamilyPage() {
  const { session, user, loading, signIn, signOut, refreshAccount } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("invite") || "";
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [lookup, setLookup] = useState<"loading" | "ready" | "missing">(token ? "loading" : "missing");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [family, setFamily] = useState<InviteMember[]>([]);
  const [access, setAccess] = useState<Record<string, AccessLevel>>({});
  const familyGrants = family.map((member) => ({
    checklistId: member.checklist_id,
    permission: access[member.checklist_id] || "view",
  }));

  useEffect(() => {
    if (!token) return;
    let active = true;
    void supabase.rpc("family_invite_members", { p_token: token }).then(({ data }) => {
      if (active && Array.isArray(data)) setFamily(data as InviteMember[]);
    });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void supabase.rpc("family_invite_details", { p_token: token }).then(({ data }) => {
      if (!active) return;
      const row = (Array.isArray(data) ? data[0] : data) as InviteDetails | undefined;
      if (!row) {
        setLookup("missing");
        return;
      }
      setDetails(row);
      setName((current) => current || row.invited_first_name || "");
      setEmail((current) => current || row.invited_email || "");
      setLookup("ready");
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function finish() {
    await refreshAccount();
    navigate("/app");
  }

  async function accept() {
    setError("");
    setBusy(true);
    const { error: err } = await supabase.rpc("accept_family_invite", { p_token: token, p_grants: familyGrants });
    if (err) {
      setBusy(false);
      setError(
        err.message.includes("INVITE_UNAVAILABLE")
          ? "This account already has its own checklist, or the invitation is no longer open. Sign out and create a new account with a different email, or ask for a new invite."
          : "We couldn't accept this invitation. Please try again.",
      );
      return;
    }
    await finish();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, invite_token: token, family_permissions: familyGrants },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    if (err) {
      setBusy(false);
      setError(
        /registered|already/i.test(err.message)
          ? "That email already has an account. Choose “I already have an account” below to sign in and accept."
          : err.message,
      );
      return;
    }
    await recordLegalAcceptance("signup", email);
    void invokeFunction("send-account-email", { name }).catch((err) => console.error("Account email failed", err));
    if (data.session) {
      await finish();
      return;
    }
    setBusy(false);
    setError("Check your email to confirm the account, then sign in and open this invite link again.");
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not sign in.");
    }
  }

  if (lookup === "loading" || loading) {
    return (
      <Card title="Opening your invitation">
        <p className="muted">One moment…</p>
      </Card>
    );
  }

  const status = lookup === "missing" || !details ? "unknown" : details.status;
  if (status !== "pending") {
    return (
      <Card title="This invitation isn't available">
        <p className="muted">{INVITE_CLOSED[status] || INVITE_CLOSED.unknown}</p>
        <Link className="btn btn-primary btn-block" style={{ marginTop: 18 }} to={session ? "/app" : "/signin"}>
          {session ? "Go to My Checklist" : "Sign in"}
        </Link>
      </Card>
    );
  }

  const inviter = details?.inviter_name || "A family member";
  const greeting = details?.invited_first_name ? `Welcome, ${details.invited_first_name}!` : "You're invited!";
  const familyAccess = family.length ? (
    <div className="signup-family">
      <h2 className="signup-section-title">Who can see your checklist?</h2>
      <p className="field-hint">
        Your checklist is yours. Choose what each person on this Family Plan can do with it. You can change this
        anytime from Manage Family Plan.
      </p>
      {family.map((member) => (
        <div className="family-setup-row" key={member.checklist_id}>
          <p className="family-setup-name">
            {member.name}
            {member.is_primary ? <span className="access-tag">Plan owner</span> : null}
            {!member.has_account ? <span className="access-tag is-muted">Invited</span> : null}
          </p>
          <AccessChoice
            name={member.name.split(" ")[0]}
            value={access[member.checklist_id] || "view"}
            onChange={(level) => setAccess((current) => ({ ...current, [member.checklist_id]: level }))}
            disabled={busy}
          />
        </div>
      ))}
    </div>
  ) : null;

  if (session) {
    return (
      <Card title={greeting}>
        <p className="join-invite-lead">
          {inviter} set up a Safety Prep Checklist for you as part of their Family Plan. It's already paid for.
        </p>
        <p className="muted">
          You're signed in as <strong>{user?.email}</strong>. Accept to add this checklist to your account.
        </p>
        {familyAccess}
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="button" disabled={busy} onClick={() => void accept()}>
          {busy ? "Accepting…" : "Accept invitation"}
        </button>
        <button className="family-setup-later" type="button" onClick={() => void signOut()}>
          Not you? Sign out
        </button>
      </Card>
    );
  }

  return (
    <Card title={greeting}>
      <p className="join-invite-lead">
        {inviter} set up a Safety Prep Checklist for you as part of their Family Plan. It's already paid for.
        {mode === "create" ? " Create your account to get started." : " Sign in to accept it."}
      </p>
      {mode === "create" ? (
        <form onSubmit={(e) => void onCreate(e)}>
          <label className="field">
            <span>Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <PasswordField value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
          {familyAccess}
          <LegalAgreement id="join-agree" checked={agreed} onChange={setAgreed} />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit" disabled={!agreed || busy}>
            {busy ? "Creating your account…" : "Create My Account"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void onSignIn(e)}>
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" minLength={1} />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      )}
      <button
        className="family-setup-later"
        type="button"
        onClick={() => {
          setError("");
          setMode(mode === "create" ? "signin" : "create");
        }}
      >
        {mode === "create" ? "I already have an account" : "I need to create an account"}
      </button>
    </Card>
  );
}
