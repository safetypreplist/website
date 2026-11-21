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
          <p className="muted legal-draft-note">
            Draft for product accuracy. Have the final legal language reviewed by an attorney before treating it as legal
            advice. These pages describe how the Service works; they do not claim to eliminate every possible liability.
          </p>
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
        {LEGAL.brandName} provides digital preparedness checklists and household planning tools. The content is general
        educational guidance only. It is not a substitute for official emergency instructions or professional advice.
      </p>

      <h2>3. Licenses and devices</h2>
      <p>
        Access is sold as a one-time lifetime license (Basic or Pro), not a subscription. One license covers one device.
        Use Transfer / Deactivate to free the license and move it to a new device, or purchase another Basic or Pro
        license for a second device. Optional Group Sharing is a separate one-time purchase that temporarily syncs
        checklists among licensed devices; it does not replace each participant’s own license. Pro includes additional
        preparedness checklists; Basic holders may upgrade to Pro for the price shown at checkout (same license key).
      </p>
      <p>
        You are responsible for keeping your license key private and for activity on devices where you activate it. No
        account login is required to use the Service on an activated device.
      </p>

      <h2 id="data-backups">4. Your checklist data, backups, and transfers</h2>
      <p>
        Your personalized checklist information — including checkmarks, notes, custom items, contacts, and similar
        progress you enter — belongs to you. That information is stored locally on your device. We do not host your
        day-to-day checklist contents as a permanent cloud account.
      </p>
      <p>
        <strong>You are responsible for preserving and backing up your personal checklist information.</strong> If you
        lose, reset, replace, or clear a device without a backup you can restore, your personalized data may be lost.
        Deactivating a license frees the license for another device; it does not automatically transfer checklist
        information to the new device.
      </p>
      <p>
        As a convenience, {LEGAL.brandName} offers free backup options (including a downloadable backup file and a
        temporary SafetyPrepList cloud backup). Cloud backups are temporary and are automatically deleted after 48 hours.
        While a temporary cloud backup remains available, you may request support-assisted retrieval. Authorized support
        personnel may access or export that backup only when necessary to fulfill a customer-requested support request.
        We do not routinely inspect customers’ personal checklist contents.
      </p>
      <p>
        Backup tools are provided as a convenience. Using them does not shift responsibility for maintaining your own
        backups away from you, and these Terms do not guarantee that every backup attempt will succeed or that temporary
        cloud storage will always be available.
      </p>

      <h2>5. Payments</h2>
      <p>
        Prices are shown at checkout as one-time amounts, plus any applicable taxes. Payments are processed by Stripe.
        We do not store card numbers. There is no automatic renewal.
      </p>

      <h2 id="refunds">6. Refunds</h2>
      <p>{LEGAL.refundPolicy}</p>
      <p className="muted">Refund Policy updated {LEGAL.refundUpdatedDate}.</p>
      <h3>How to request a refund</h3>
      <p>
        <Link to="/contact?topic=refund">Click here</Link> to request your refund within 3 days of your first purchase.
        Include your confirmation number if you have it.
      </p>
      <h3>Printing</h3>
      <p>
        The Service does not provide an in-app print or print-to-PDF feature. If you print a checklist with your
        browser’s print tools within the refund window, that can still end refund eligibility. We may record when a
        browser print dialog is opened from a checklist page.
      </p>
      <h3>Pro upgrades</h3>
      <p>
        Additional Pro checklists are included with Pro (or after a Basic-to-Pro upgrade). Refund requests follow the same
        3-day first-purchase rule.
      </p>

      <h2>7. User content</h2>
      <p>
        Notes, custom items, contacts, and other information you enter belong to you. Because that content is stored on
        your device (and, if you choose, in a temporary backup you create), you give us only the limited rights needed to
        operate optional features you use — for example, processing a temporary cloud backup or fulfilling a
        customer-requested support export. Do not store passwords, PINs, full Social Security numbers, or financial
        account numbers in notes.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        Checklists, copy, design, software, and the {LEGAL.brandName} brand are owned by{" "}
        {displayLegal(LEGAL.legalName)}. We grant you a personal, non-commercial license to use the Service for your
        household. You may not resell, redistribute, scrape, or copy the Service for others.
      </p>

      <h2>9. Acceptable use and termination</h2>
      <p>
        Do not misuse the Service, attempt unauthorized access, or use it to harm others. We may suspend or end license
        access that abuses the Service or violates these Terms.
      </p>

      <h2>10. Disclaimer of warranties</h2>
      <p>
        The Service is provided “as is” and “as available.” We disclaim all warranties to the maximum extent allowed by
        law, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
        This includes any warranty that free backup tools will always succeed or that temporary cloud backups will remain
        available for the full 48-hour window in every case.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent allowed by law, our total liability for claims related to the Service is limited to the
        amount you paid us for the license that gives rise to the claim. We are not liable for indirect, incidental,
        special, consequential, or punitive damages, including lost data, lost profits, or personal injury arising from
        use of the checklists or related activities. These limits do not claim to eliminate every possible liability
        where applicable law does not allow such a limitation. Some jurisdictions do not allow certain limits; in those
        places, our liability is limited to the fullest extent permitted.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You will defend and indemnify us against claims arising from your misuse of the Service or your violation of
        these Terms, except to the extent a claim is caused by our own misconduct.
      </p>

      <h2>13. Dispute resolution</h2>
      <p>
        These Terms are governed by the laws of {displayLegal(LEGAL.governingState)},{" "}
        {displayLegal(LEGAL.governingCountry)}, without regard to conflict-of-law rules. Please{" "}
        <Link to="/contact">click here to contact us</Link> first so we can try to resolve the issue informally.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these Terms. We will post the new effective date on this page and, for material changes, ask you to
        accept the updated Terms when you next use checkout or the app. Continued use after that means you accept the new
        Terms.
      </p>

      <h2 id="do-not-sell">15. Do Not Sell or Share My Personal Information</h2>
      <p>
        We do not sell personal information and we do not share it for advertising or other unrelated commercial purposes.
        If you are a resident of California or another state with consumer privacy rights, you may request to know,
        delete, or correct personal information by using the contact form.{" "}
        <Link to="/contact?topic=do-not-sell">Click here to contact us</Link>. We will not discriminate against you for
        making a request.
      </p>

      <h2>16. Contact</h2>
      <p>
        {displayLegal(LEGAL.legalName)}
        <br />
        <Link to="/contact">Click here to contact us</Link>
        <br />
        Current document version: {LEGAL_VERSIONS.terms}
      </p>
      <p className="muted">
        These documents are intended to describe how the Service works. Have the final legal language reviewed by an
        attorney before relying on it as counsel. {copyrightLine()}
      </p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <LegalNav />
      <p>
        This Privacy Policy explains what {LEGAL.brandName} collects and how we use it. It matches the systems we
        actually use today. We do not sell personal information, and we do not share it with third parties for
        advertising or unrelated purposes.
      </p>

      <h2 id="collect">1. What we collect</h2>
      <ul>
        <li>
          Purchase and license information: payer email, license key, product (Basic or Pro), Stripe payment references,
          and activation status. Stripe handles card and bank details. We do not store card numbers.
        </li>
        <li>
          Device activation: a device identifier for the device where you activate a license, so one license stays tied
          to one device unless you deactivate and transfer it or buy another license.
        </li>
        <li>
          Checklist information you create (checkmarks, short notes, custom items, contacts, and similar progress). That
          information is stored locally on your device. We do not keep a permanent cloud copy of your day-to-day checklist
          contents as an account profile.
        </li>
        <li>
          Optional temporary cloud backups you create when transferring devices. Those backups are stored only for a
          limited time and are automatically deleted after 48 hours.
        </li>
        <li>
          Deactivation and transfer support records needed to operate the Service (for example, that a deactivation was
          requested, backup decision indicators, and whether a temporary backup remains available).
        </li>
        <li>Email-list signups for the free Emergency Documents Checklist (name and email).</li>
        <li>Support chat messages and support requests you send us.</li>
        <li>Approximate location and weather if you use the in-app weather display (browser location or IP-based lookup).</li>
        <li>
          Technical data needed to run the app: local license session on this device, legal acknowledgments, and a
          service worker for offline use.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        We process personal information only as needed to provide the Service, including: processing one-time payments;
        issuing and recovering license keys; activating and enforcing one-device licenses; sending transactional email;
        operating optional temporary backups; fulfilling customer-requested support (including support-assisted backup
        retrieval while a temporary backup remains available); preventing abuse; and improving the product. Marketing
        email is sent only if you join the free-checklist list or otherwise ask for it, and every marketing email includes
        an unsubscribe path.
      </p>
      <p>
        <strong>You are responsible for maintaining your own backups of checklist information stored on your device.</strong>{" "}
        Free backup options are a convenience. Deactivating a license does not automatically transfer your checklist data.
      </p>

      <h2 id="checklist-access">3. Checklist contents and support access</h2>
      <p>
        We do not routinely inspect customers’ personal checklist contents. Authorized support personnel may access or
        export a temporary cloud backup when necessary to fulfill a customer-requested support request, and only while
        that backup remains available. Support-created export copies are handled for that support task and should be
        deleted when the task is complete.
      </p>
      <p>
        You may type health or other personal details into notes. Treat notes as private to your device. Do not enter
        highly sensitive data such as government IDs, financial account numbers, or passwords.
      </p>

      <h2>4. Sharing</h2>
      <p>
        We share data only with the service providers that help us run the product, when required by law, or in a business
        transfer. We do not sell personal information and we do not share it with third parties for advertising or
        unrelated purposes. Current providers:
      </p>
      <ul>
        <li>Supabase — database, temporary backup file storage, and serverless functions.</li>
        <li>Stripe — checkout and payment processing.</li>
        <li>Resend — purchase, license, recovery, and transfer confirmation email.</li>
        <li>Brevo — free Emergency Documents Checklist email list.</li>
        <li>LiveAgent — live chat and support requests.</li>
        <li>Google Fonts — display fonts.</li>
        <li>Open-Meteo and BigDataCloud — optional weather and approximate location.</li>
        <li>Google Analytics and Contentsquare — optional site analytics if you accept cookies.</li>
      </ul>

      <h2>5. Retention and deletion</h2>
      <p>
        Checklist progress and notes primarily live on your device until you delete them, clear browser storage, or lose
        the device. Temporary cloud backups are automatically deleted after 48 hours. You may request deletion of purchase
        and license records we hold by using the contact form. We keep transaction records, license administration
        records, and terms acceptances as needed for taxes, accounting, fraud prevention, security, and legal obligations.
      </p>

      <h2>6. Security</h2>
      <p>
        We use reasonable safeguards, including encrypted transport and access-controlled databases. No method of storage
        or transmission is completely secure. Because checklist information is stored on your device, protecting that
        device (and any backup files you download) is also part of keeping your information safe.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You may request access, correction, or deletion of your personal information, and you may opt out of marketing
        email at any time. <Link to="/contact?topic=privacy">Click here to contact us</Link>.
      </p>
      <h3 id="do-not-sell">California and other U.S. state privacy rights</h3>
      <p>
        We do not sell personal information and we do not share it for cross-context behavioral advertising or other
        advertising purposes. If you are a resident of California or another state with consumer privacy rights, you may
        request to know, delete, or correct personal information by using the contact form.{" "}
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
      <p className="muted">
        Have the final legal language reviewed by an attorney. {copyrightLine()}
      </p>
    </LegalShell>
  );
}
