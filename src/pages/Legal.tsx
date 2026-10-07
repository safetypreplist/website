// DRAFT — requires attorney review before launch.

import { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { PublicFooter, PublicHeader } from "../components/PublicChrome";
import {
  LEGAL,
  LEGAL_VERSIONS,
  copyrightLine,
  displayLegal,
} from "../lib/legal";

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);
  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="section cream">
        <div className="wrap legal-page">
          <p className="eyebrow">Effective {LEGAL.effectiveDate}</p>
          <h1>{title}</h1>
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function LegalNav() {
  return (
    <p className="legal-nav">
      <Link to="/terms">Terms and Conditions</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/contact">Contact</Link>
    </p>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms and Conditions">
      <LegalNav />
      <p>
        These Terms of Service (“Terms”) govern your use of {LEGAL.brandName} and {LEGAL.brandMethod}™
        (the “Service”), operated by {displayLegal(LEGAL.legalName)} (“we,” “us”). By creating an account,
        checking the agreement box, or using the Service, you agree to these Terms.
      </p>

      <aside className="legal-callout">
        <h2>Important disclaimers</h2>
        <ul>
          <li>This Service is not medical, legal, financial, engineering, or emergency-management advice.</li>
          <li>Always follow instructions from local emergency officials, evacuation orders, and emergency services first.</li>
          <li>We do not guarantee safety or any particular outcome. Preparedness can reduce risk; it cannot eliminate it.</li>
          <li>
            You are responsible for verifying quantities, expiration dates, product instructions, and local laws,
            including fuel storage, generator use, water treatment, medications, and tourniquets.
          </li>
          <li>
            Items involving fuel, generators, batteries, water treatment, medical supplies, and tools carry inherent
            risk. You act at your own risk and should follow manufacturer instructions.
          </li>
          <li>Content may be incomplete or out of date.</li>
        </ul>
      </aside>

      <h2>1. Acceptance and eligibility</h2>
      <p>
        You must be 18 or older to use the Service. The Service is not directed to children. If you do not agree to
        these Terms, do not use the Service.
      </p>

      <h2>2. What the Service is</h2>
      <p>
        {LEGAL.brandName} provides digital and printable preparedness checklists and household planning tools. The
        content is general educational guidance only. It is not a substitute for official emergency instructions or
        professional advice.
      </p>

      <h2>3. Accounts and Family Plans</h2>
      <p>
        You are responsible for your login credentials and for activity on your account. Family Plan owners are
        responsible for the people they add and the permissions they grant (View Only or Can Edit). View Only members
        can see a shared checklist, including checkmarks and notes. Can Edit members can change checkmarks, notes, and
        custom items on that checklist.
      </p>

      <h2>4. Subscriptions and payments</h2>
      <p>
        Individual and Family plans are billed monthly or annually at the price shown at checkout, plus any applicable
        taxes. Billing renews automatically at the then-current rate until you cancel. Survival Vault is an optional
        one-time purchase and does not renew. Payments are processed by PayPal. We do not store card numbers.
      </p>
      <p>
        Cancel anytime in Account Settings before your next billing date, or{" "}
        <Link to="/contact?topic=cancel">click here to contact us</Link>. After you cancel, you keep
        access through the end of the paid period. We do not provide partial-period refunds on renewals. Survival Vault
        access already purchased stays with the household unless we are required to remove it.
      </p>

      <h2 id="refunds">5. Refunds</h2>
      <p>{LEGAL.refundPolicy}</p>
      <h3>How to request a refund</h3>
      <p>
        <Link to="/contact?topic=refund">Click here</Link> to request your refund within 7 days of your first purchase.
        Include your purchase reference if you have it.
      </p>
      <h3>Renewals</h3>
      <p>
        We do not give partial-period refunds on monthly or annual renewals. Cancel in Account Settings before the
        next billing date to avoid the next charge. You keep access through the end of the period you already paid.
      </p>
      <h3>Survival Vault</h3>
      <p>Survival Vault is a one-time add-on. It does not renew. Refund requests follow the same 7-day first-purchase rule.</p>

      <h2>6. User content</h2>
      <p>
        Notes and custom items belong to you. You give us a limited license to store and display them only as needed
        to provide the Service, including to people you grant Family Plan access. Do not store passwords, PINs, full
        Social Security numbers, or financial account numbers in notes.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        Checklists, copy, design, software, and the {LEGAL.brandName} and {LEGAL.brandMethod}™ brands are owned by{" "}
        {displayLegal(LEGAL.legalName)}. We grant you a personal, non-commercial license to use the Service and to
        print lists for your household. You may not resell, redistribute, scrape, or copy the Service for others.
      </p>

      <h2>8. Acceptable use and termination</h2>
      <p>
        Do not misuse the Service, attempt unauthorized access, or use it to harm others. We may suspend or end
        accounts that abuse the Service or violate these Terms.
      </p>

      <h2>9. Disclaimer of warranties</h2>
      <p>
        The Service is provided “as is” and “as available.” We disclaim all warranties to the maximum extent allowed
        by law, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent allowed by law, our total liability for claims related to the Service is limited to the
        amount you paid us in the prior 12 months. We are not liable for indirect, incidental, special, consequential,
        or punitive damages, including lost data, lost profits, or personal injury arising from use of the checklists
        or related activities. Some jurisdictions do not allow certain limits; in those places, our liability is
        limited to the fullest extent permitted.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You will defend and indemnify us against claims arising from your misuse of the Service or your violation of
        these Terms, except to the extent a claim is caused by our own misconduct.
      </p>

      <h2>12. Dispute resolution</h2>
      <p>
        These Terms are governed by the laws of {displayLegal(LEGAL.governingState)}, {displayLegal(LEGAL.governingCountry)},
        without regard to conflict-of-law rules. Please <Link to="/contact">click here to contact us</Link> first so we can try to
        resolve the issue informally.
      </p>
      <p className="legal-todo">{displayLegal(LEGAL.arbitration)}</p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms. We will post the new effective date on this page and, for material changes, ask
        existing users to accept the updated Terms on next login. Continued use after that means you accept the new
        Terms.
      </p>

      <h2 id="do-not-sell">14. Do Not Sell or Share My Personal Information</h2>
      <p>
        We do not sell personal information and we do not share it for cross-context behavioral advertising. If you
        are a resident of California or another state with consumer privacy rights, you may request to know, delete,
        or correct personal information by using the contact form. <Link to="/contact?topic=do-not-sell">Click here to contact us</Link>. We will not discriminate against
        you for making a request.
      </p>

      <h2>15. Contact</h2>
      <p>
        {displayLegal(LEGAL.legalName)}
        <br />
        <Link to="/contact">Click here to contact us</Link>
        <br />
        Current document version: {LEGAL_VERSIONS.terms}
      </p>
      <p className="muted">{copyrightLine()}</p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <LegalNav />
      <p>
        This Privacy Policy explains what {LEGAL.brandName} collects and how we use it. It matches the systems we
        actually use today. We do not sell personal information.
      </p>

      <h2 id="collect">1. What we collect</h2>
      <ul>
        <li>Account information: name, email, optional phone number, optional profile photo, and password (stored by our auth provider, not in readable form).</li>
        <li>Plan and payment status: plan type, billing interval, renewal date, PayPal order references, and payer email. PayPal handles card and bank details. We do not store card numbers.</li>
        <li>Checklist data: checkmarks, short notes, custom items, emergency contacts you add, and device nicknames.</li>
        <li>Family Plan relationships: who is connected, and whether they have View Only or Can Edit access.</li>
        <li>Email-list signups for the free Emergency Documents Checklist (name and email).</li>
        <li>Support chat messages if you use the optional Tawk.to widget.</li>
        <li>Approximate location and weather if you use the in-app weather display (browser location or IP-based lookup).</li>
        <li>Technical data needed to run the app: sign-in session, device registration, and a service worker for offline use.</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        We use this information to provide the Service, process payments, give support, keep Family Plan sharing
        working, send transactional email, and improve the product. Marketing email is sent only if you join the
        free-checklist list or otherwise ask for it, and every marketing email includes an unsubscribe path.
      </p>

      <h2>3. Notes and sensitive information</h2>
      <p>
        You may type health or other personal details into notes. We treat notes as private. They are visible to you
        and to anyone you explicitly grant access through the Family Plan. We do not sell personal information. Do
        not enter highly sensitive data such as government IDs, financial account numbers, or passwords.
      </p>

      <h2>4. Sharing</h2>
      <p>We share data only with the service providers that run the product, when required by law, or in a business transfer. Current providers:</p>
      <ul>
        <li>Supabase — account authentication, database, file storage, and serverless functions.</li>
        <li>PayPal — checkout and payment processing.</li>
        <li>Resend — purchase and account email.</li>
        <li>Brevo — free Emergency Documents Checklist email list.</li>
        <li>Tawk.to — optional support chat, only if you accept optional cookies.</li>
        <li>Google Fonts — display fonts.</li>
        <li>Open-Meteo and BigDataCloud — optional weather and approximate location.</li>
      </ul>
      <p>We do not sell personal data and we do not share it for cross-context advertising.</p>

      <h2>5. Family Plan visibility</h2>
      <p>
        A Family Plan owner can invite members and set View Only or Can Edit on each Personal Checklist. View Only
        members can open that checklist and see items, checkmarks, and notes. They cannot change checkmarks, notes,
        or custom items. Can Edit members can change those things on the checklist they were granted. Household
        Survival Vault lists follow the same connected-plan rules. Members do not get access to checklists they were
        not granted.
      </p>

      <h2>6. Retention and deletion</h2>
      <p>
        You can download a copy of your data and request deletion in Account Settings. Deletion removes your profile,
        checklist progress, notes, custom items, contacts, devices, and login. We keep transaction records and terms
        acceptances as needed for taxes, accounting, fraud prevention, and legal obligations.
      </p>

      <h2>7. Security</h2>
      <p>
        We use reasonable safeguards, including encrypted transport, access-controlled databases, and hashed
        passwords. No method of storage or transmission is completely secure.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You may request access, correction, or deletion of your personal information, and you may opt out of
        marketing email at any time. <Link to="/contact?topic=privacy">Click here to contact us</Link>.
      </p>
      <h3 id="do-not-sell">California and other U.S. state privacy rights</h3>
      <p>
        We do not sell personal information and we do not share it for cross-context behavioral advertising. If you
        are a resident of California or another state with consumer privacy rights, you may request to know, delete,
        or correct personal information by using the contact form. <Link to="/contact?topic=do-not-sell">Click here to contact us</Link>. We will not discriminate against
        you for making a request.
      </p>
      <p className="legal-todo">{displayLegal(LEGAL.gdpr)}</p>

      <h2>9. Children</h2>
      <p>The Service is for users 18 and older and is not intended for children under 13. We do not knowingly collect personal information from children.</p>

      <h2>10. Cookies</h2>
      <p>
        Essential cookies and local storage keep you signed in and remember device and legal acknowledgments. Optional
        Tawk.to chat cookies load only if you accept optional cookies. We do not run a third-party advertising or
        analytics pixel.
      </p>

      <h2>11. Changes and contact</h2>
      <p>
        We may update this policy and will change the effective date above. For questions,{" "}
        <Link to="/contact?topic=privacy">click here to contact us</Link>. Version {LEGAL_VERSIONS.privacy}.
      </p>
      <p className="muted">{copyrightLine()}</p>
    </LegalShell>
  );
}
