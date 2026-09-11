import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BrandMark } from "../components/Brand";
import { PublicHeader } from "../components/PublicChrome";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { PRODUCT_CODE_RE } from "../lib/format";
import { PHOTO_LIBRARY } from "../lib/photos";
import { CheckoutProgress } from "./Purchase";

function PasswordField({
  value,
  onChange,
  autoComplete,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>Password</span>
      <div className="password-field">
        <input
          type={visible ? "text" : "password"}
          required
          minLength={8}
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
    </div>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const { signIn } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signIn(email, password);
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    }
  }

  return (
    <Card title="Sign in">
      <form onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit">
          Sign In
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        <Link to="/reset-password">Forgot password?</Link>
        <br />
        New here? <Link to="/pricing">Get Safety Prep List</Link>
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
          hint="At least 8 characters. Use a mix of letters and numbers so it’s easier to remember and harder to guess."
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
  const { demoMode } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stored = sessionStorage.getItem("spl.productCode") || "";
  const code = (params.get("code") || stored || (demoMode ? "RDM-7K4F-92LX" : "")).toUpperCase();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [previewNote, setPreviewNote] = useState(false);
  const validCode = useMemo(() => PRODUCT_CODE_RE.test(code), [code]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPreviewNote(false);
    if (demoMode) {
      setPreviewNote(true);
      return;
    }
    if (!validCode) {
      setError("We could not find a Product ID from checkout. Complete purchase first.");
      return;
    }
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, product_code: code },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      sessionStorage.removeItem("spl.productCode");
      navigate("/app");
      return;
    }
    setError("Check your email to confirm the account, then sign in. Your Product ID is already attached.");
  }

  return (
      <Card title="Create my account" progress={2}>
      {code && <p className="product-id">{code}</p>}
      <form onSubmit={onSubmit}>
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
          hint="At least 8 characters. Use a mix of letters and numbers so it’s easier to remember and harder to guess."
        />
        {error && <p className="form-error">{error}</p>}
        {previewNote && (
          <p className="muted" style={{ marginTop: 12 }}>
            This is a preview of the create-account screen. Cloud signup is not connected yet.{" "}
            <Link to="/signin">Sign in to demo</Link> to look inside the app.
          </p>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} type="submit">
          Create My Account
        </button>
      </form>
    </Card>
  );
}
