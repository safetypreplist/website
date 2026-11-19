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
      <Link to="/terms">Terms of Service</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/contact">Contact</Link>
    </p>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <LegalNav />
      <p>
        These Terms of Service (“Terms”) govern your use of {LEGAL.brandName} (the “Service”), operated by{" "}
        {displayLegal(LEGAL.legalName)} (“we,” “us”). By checking the agreement box at checkout, activating a license,
        or using the Service, you agree to these Terms.
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

      <h2>3. Licenses and devices</h2>
      <p>
        Access is sold as a one-time lifetime license (Basic or Pro), not a subscription. One license covers one device.
        You may purchase an additional Basic license for a second device from the license page after you activate, or use
        Transfer / Deactivate to free the license and move it to a new device. Pro includes Survival Vault checklists;
        Basic holders may upgrade to Pro for the price shown at checkout (same license key).
      </p>
      <p>
        You are responsible for keeping your license key private and for activity on devices where you activate it. No
        account login is required to use the Service on an activated device.
      </p>

      <h2>4. Payments</h2>
      <p>
        Prices are shown at checkout as one-time amounts, plus any applicable taxes. Payments are processed by Stripe.
        We do not store card numbers. There is no automatic renewal.
      </p>

      <h2 id="refunds">5. Refunds</h2>
      <p>{LEGAL.refundPolicy}</p>
      <p className="muted">Refund Policy updated {LEGAL.refundUpdatedDate}.</p>
      <h3>How to request a refund</h3>
      <p>
        <Link to="/contact?topic=refund">Click here</Link> to request your refund within 3 days of your first purchase.
        Include your confirmation number if you have it.
      </p>
      <h3>Printing</h3>
      <p>
        A purchase is no longer refundable once any checklist tied to that license has been printed or saved as a PDF. We
        record when the print window is opened from a checklist page. While you are still eligible for a refund, the app
        asks you to confirm before printing.
      </p>
      <h3>Survival Vault / Pro</h3>
      <p>
        Survival Vault checklists are included with Pro (or after a Basic-to-Pro upgrade). Refund requests follow the same
        3-day, not-printed first-purchase rule.
      </p>

      <h2>6. User content</h2>
      <p>
        Notes and custom items belong to you. You give us a limited license to store and display them only as needed to
        provide the Service on your activated device. Do not store passwords, PINs, full Social Security numbers, or
        financial account numbers in notes.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        Checklists, copy, design, software, and the {LEGAL.brandName} brand are owned by{" "}
        {displayLegal(LEGAL.legalName)}. We grant you a personal, non-commercial license to use the Service and to print
        lists for your household. You may not resell, redistribute, scrape, or copy the Service for others.
      </p>

      <h2>8. Acceptable use and termination</h2>
      <p>
        Do not misuse the Service, attempt unauthorized access, or use it to harm others. We may suspend or end license
        access that abuses the Service or violates these Terms.
      </p>

      <h2>9. Disclaimer of warranties</h2>
      <p>
        The Service is provided “as is” and “as available.” We disclaim all warranties to the maximum extent allowed by
        law, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent allowed by law, our total liability for claims related to the Service is limited to the
        amount you paid us for the license that gives rise to the claim. We are not liable for indirect, incidental,
        special, consequential, or punitive damages, including lost data, lost profits, or personal injury arising from
        use of the checklists or related activities. Some jurisdictions do not allow certain limits; in those places, our
        liability is limited to the fullest extent permitted.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You will defend and indemnify us against claims arising from your misuse of the Service or your violation of
        these Terms, except to the extent a claim is caused by our own misconduct.
      </p>

      <h2>12. Dispute resolution</h2>
      <p>
        These Terms are governed by the laws of {displayLegal(LEGAL.governingState)},{" "}
        {displayLegal(LEGAL.governingCountry)}, without regard to conflict-of-law rules. Please{" "}
        <Link to="/contact">click here to contact us</Link> first so we can try to resolve the issue informally.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms. We will post the new effective date on this page and, for material changes, ask you to
        accept the updated Terms when you next use checkout or the app. Continued use after that means you accept the new
        Terms.
      </p>

      <h2 id="do-not-sell">14. Do Not Sell or Share My Personal Information</h2>
      <p>
        We do not sell personal information and we do not share it for cross-context behavioral advertising. If you are a
        resident of California or another state with consumer privacy rights, you may request to know, delete, or correct
        personal information by using the contact form.{" "}
        <Link to="/contact?topic=do-not-sell">Click here to contact us</Link>. We will not discriminate against you for
        making a request.
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
        <li>
          Purchase and license information: payer email, license key, product (Basic or Pro), Stripe payment references,
          and activation status. Stripe handles card and bank details. We do not store card numbers.
        </li>
        <li>
          Device activation: a device identifier for the device where you activate a license, so one license stays tied
          to one device unless you deactivate and transfer it or buy an additional license.
        </li>
        <li>Checklist data stored on your device and synced as needed: checkmarks, short notes, custom items, and emergency contacts you add.</li>
        <li>Email-list signups for the free Emergency Documents Checklist (name and email).</li>
        <li>Support chat messages and support requests you send us.</li>
        <li>Approximate location and weather if you use the in-app weather display (browser location or IP-based lookup).</li>
        <li>Technical data needed to run the app: local license session on this device, and a service worker for offline use.</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        We use this information to provide the Service, process one-time payments, activate and enforce device licenses,
        give support, send transactional email (including your license key), and improve the product. Marketing email is
        sent only if you join the free-checklist list or otherwise ask for it, and every marketing email includes an
        unsubscribe path.
      </p>

      <h2>3. Notes and sensitive information</h2>
      <p>
        You may type health or other personal details into notes. We treat notes as private to your activated device. We
        do not sell personal information. Do not enter highly sensitive data such as government IDs, financial account
        numbers, or passwords.
      </p>

      <h2>4. Sharing</h2>
      <p>We share data only with the service providers that run the product, when required by law, or in a business transfer. Current providers:</p>
      <ul>
        <li>Supabase — database, file storage, and serverless functions.</li>
        <li>Stripe — checkout and payment processing.</li>
        <li>Resend — purchase and license email.</li>
        <li>Brevo — free Emergency Documents Checklist email list.</li>
        <li>LiveAgent — live chat and support requests.</li>
        <li>Google Fonts — display fonts.</li>
        <li>Open-Meteo and BigDataCloud — optional weather and approximate location.</li>
      </ul>
      <p>We do not sell personal data and we do not share it for cross-context advertising.</p>

      <h2>5. Retention and deletion</h2>
      <p>
        Checklist progress and notes primarily live on your device. You may request deletion of purchase and license
        records we hold by using the contact form. We keep transaction records and terms acceptances as needed for taxes,
        accounting, fraud prevention, and legal obligations.
      </p>

      <h2>6. Security</h2>
      <p>
        We use reasonable safeguards, including encrypted transport and access-controlled databases. No method of storage
        or transmission is completely secure.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You may request access, correction, or deletion of your personal information, and you may opt out of marketing
        email at any time. <Link to="/contact?topic=privacy">Click here to contact us</Link>.
      </p>
      <h3 id="do-not-sell">California and other U.S. state privacy rights</h3>
      <p>
        We do not sell personal information and we do not share it for cross-context behavioral advertising. If you are a
        resident of California or another state with consumer privacy rights, you may request to know, delete, or correct
        personal information by using the contact form.{" "}
        <Link to="/contact?topic=do-not-sell">Click here to contact us</Link>. We will not discriminate against you for
        making a request.
      </p>

      <h2>8. Children</h2>
      <p>The Service is for users 18 and older and is not intended for children under 13. We do not knowingly collect personal information from children.</p>

      <h2>9. Cookies</h2>
      <p>
        Essential cookies and local storage keep your license session on this device and remember legal acknowledgments.
        LiveAgent chat cookies load only when you open the chat. If you accept cookies, Google Analytics and Contentsquare
        measure how the site is used. Declining leaves only those essential cookies and turns Contentsquare off in this
        browser. We do not run advertising pixels.
      </p>

      <h2>10. Changes and contact</h2>
      <p>
        We may update this policy and will change the effective date above. For questions,{" "}
        <Link to="/contact?topic=privacy">click here to contact us</Link>. Version {LEGAL_VERSIONS.privacy}.
      </p>
      <p className="muted">{copyrightLine()}</p>
    </LegalShell>
  );
}
