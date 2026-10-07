import { Link } from "react-router-dom";

export function LegalAgreement({
  checked,
  onChange,
  id = "legal-agree",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <label className="legal-agree" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        I agree to the{" "}
        <Link to="/terms" target="_blank" rel="noreferrer">
          Terms of Service
        </Link>
        ,{" "}
        <Link to="/privacy" target="_blank" rel="noreferrer">
          Privacy Policy
        </Link>
        , and{" "}
        <Link to="/refunds" target="_blank" rel="noreferrer">
          Refund Policy
        </Link>
        , and I understand this is general guidance and not professional advice.
      </span>
    </label>
  );
}

export function AutoRenewalNote({
  amount,
  interval,
}: {
  amount: string;
  interval: "month" | "year";
}) {
  return (
    <p className="renewal-note">
      You will be charged {amount} every {interval} until you cancel. Cancel anytime in Account Settings before your
      next billing date.
    </p>
  );
}
