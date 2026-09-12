import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page">
          <h1>{title}</h1>
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy">
      <p>
        Safety Prep List stores the information needed to run your household account: sign-in credentials,
        checklist progress, notes, emergency contacts, registered devices, Family Plan connections, and purchase records.
      </p>
      <p>
        We do not sell personal information. Payment is processed by PayPal. Account data is stored with
        our cloud provider and protected with access controls for your household. If you join the email list
        for the free Emergency Documents Checklist, we send that address to our email provider so we can
        deliver the download and occasional preparedness notes. You can unsubscribe at any time.

      </p>
      <p>
        Questions about privacy can be sent to info@safetypreplist.com.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms">
      <p>
        Safety Prep List is billed Monthly or Annually per Personal Checklist. Survival Vault is an optional one-time
        add-on. Your login may be used on up to two devices at a time. Devices are where you sign in; they do not create
        extra people or checklists.
      </p>
      <p>
        Content is for household preparedness planning. It is not a substitute for official emergency
        instructions from local authorities.
      </p>
      <p>
        Access continues for the paid Monthly or Annual period. Existing customers keep their personal checklists,
        progress, family connections, and Survival Vault entitlement. We may update checklists and supporting materials
        over time.
      </p>
    </LegalShell>
  );
}

export function SupportPage() {
  const email = import.meta.env.VITE_SUPPORT_EMAIL || "info@safetypreplist.com";
  const name = import.meta.env.VITE_SUPPORT_NAME || "Safety Prep List Support";

  return (
    <LegalShell title="Support">
      <p>
        Need help with your purchase, account, or devices? {name} is here.
      </p>
      <p>
        Email <a href={`mailto:${email}`}>{email}</a> and include the email on your account.
      </p>
    </LegalShell>
  );
}
