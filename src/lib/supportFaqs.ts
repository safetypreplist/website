import { money } from "./format";
import type { ChatTopic } from "./liveAgent";
import {
  BASIC_ADDITIONAL_CENTS,
  BASIC_LICENSE_CENTS,
  PRO_LICENSE_CENTS,
  UPGRADE_TO_PRO_CENTS,
} from "./pricing";

export type SupportFaq = {
  id: string;
  question: string;
  answer: string;
  linkTo?: string;
  linkLabel?: string;
  /** Who should see this in chat. Help shows the full set. */
  audience: "all" | "visitor" | "member";
  topic: ChatTopic;
};

const CHECKLISTS =
  "5-Minute Grab-and-Go Bag, 15-Minute Ready Duffel (72-Hour Continuity Kit), 20-Minute Vehicle OR Suitcase Prep, and 60-Minute Home Resilience";
const PRO_LISTS =
  "Off-Grid Systems, Water Purification, Home Battery & Solar, Emergency Cooling / Heat Resilience, and Long-Term Food";
const REFUND_RULE =
  "First purchases can be refunded within 3 days as long as no checklist has been printed or saved as a PDF.";

/** Single source of truth for Help and live-support quick answers. */
export const SUPPORT_FAQS: SupportFaq[] = [
  // —— License and Activation ——
  {
    id: "activate-how",
    question: "How do I activate my license?",
    answer:
      "Open Activate, enter the license key from your purchase email exactly as shown, and confirm. After a successful activation, this device can open your checklists. If you are already licensed on another device, deactivate there first or use Transfer / Deactivate.",
    linkTo: "/activate",
    linkLabel: "Activate",
    audience: "all",
    topic: "support",
  },
  {
    id: "activate-fail",
    question: "I can't activate my license.",
    answer:
      "Check that the key matches your purchase email, including dashes. If the key is already active on another device, open Transfer / Deactivate with that key, complete deactivation, then activate on this device. Purchases and activation need an internet connection.",
    linkTo: "/transfer",
    linkLabel: "Transfer / Deactivate",
    audience: "all",
    topic: "support",
  },
  {
    id: "lost-key",
    question: "I lost my license key.",
    answer:
      "Use Recover My License and enter the email from your original purchase. We send a secure one-time link so you can view your key. If that license is still active on another device, deactivate it before activating on a new one.",
    linkTo: "/license-recovery",
    linkLabel: "Recover My License",
    audience: "all",
    topic: "support",
  },
  {
    id: "recover-license",
    question: "How do I recover my license?",
    answer:
      "Go to Recover My License, enter your purchase email, and open the secure link we send. That shows your license key so you can activate or transfer. We do not email the raw key in the first message—only the recovery link.",
    linkTo: "/license-recovery",
    linkLabel: "Recover My License",
    audience: "all",
    topic: "support",
  },
  {
    id: "move-license",
    question: "How do I move my license to another device?",
    answer:
      "On the current device, open Transfer / Deactivate. Back up your checklists (downloadable file and/or temporary cloud backup), then deactivate. On the new device, open Activate with the same key, then restore from your backup file or cloud backup if you created one. Deactivation does not move checklist data by itself.",
    linkTo: "/transfer",
    linkLabel: "Transfer / Deactivate",
    audience: "all",
    topic: "support",
  },
  {
    id: "deactivate",
    question: "How do I deactivate my license?",
    answer:
      "Open Transfer / Deactivate or Deactivate, choose a backup option if you want to keep your checklist data, then confirm deactivation with the email flow. After it succeeds, the key can be activated on another device. Your checklists stay on the old device until you clear them; they are not automatically copied unless you restore a backup you created.",
    linkTo: "/deactivate",
    linkLabel: "Deactivate",
    audience: "all",
    topic: "support",
  },

  // —— Backups and Transfers ——
  {
    id: "backup-how",
    question: "How do I back up my checklist?",
    answer:
      "Open Transfer / Deactivate (or the backup reminder during deactivation). You can download a backup file to keep yourself, and/or create a free temporary SafetyPrepList cloud backup. Only treat a backup as complete when the app confirms the download or cloud upload succeeded.",
    linkTo: "/app/transfer",
    linkLabel: "Open Transfer / Deactivate",
    audience: "member",
    topic: "support",
  },
  {
    id: "backup-cloud-free",
    question: "Is cloud backup free?",
    answer:
      "Yes. The temporary SafetyPrepList cloud backup offered during transfer or deactivation is free. It is a convenience for moving devices, not a permanent storage plan.",
    linkTo: "/transfer",
    linkLabel: "Transfer / Deactivate",
    audience: "all",
    topic: "support",
  },
  {
    id: "backup-48h",
    question: "How long is my temporary cloud backup available?",
    answer:
      "Temporary cloud backups are automatically deleted after 48 hours. Download a backup file if you need a longer-term copy. Availability depends on a successful upload; the app only confirms a cloud backup when that step completes.",
    audience: "all",
    topic: "support",
  },
  {
    id: "backup-download",
    question: "How do I download a backup file?",
    answer:
      "In Transfer / Deactivate, choose the downloadable backup option and save the JSON file somewhere you can open from your new device. Import that file after you activate on the new device. Confirm the file finished downloading before you deactivate.",
    linkTo: "/app/transfer",
    linkLabel: "Transfer / Deactivate",
    audience: "member",
    topic: "support",
  },
  {
    id: "transfer-checklist",
    question: "How do I transfer my checklist to another device?",
    answer:
      "1) Create a backup (file and/or temporary cloud). 2) Deactivate the license on the old device. 3) Activate the same key on the new device. 4) Import your backup file or restore the temporary cloud backup while it is still available. Checklist progress is not moved unless you restore a backup you successfully created.",
    linkTo: "/transfer",
    linkLabel: "Transfer / Deactivate",
    audience: "all",
    topic: "support",
  },
  {
    id: "backup-support-help",
    question: "Can SafetyPrepList help me retrieve my backup?",
    answer:
      "While a temporary cloud backup is still within the 48-hour window, you can contact support and request assisted retrieval. Support may access that backup only to fulfill your request. After 48 hours the cloud backup is deleted. File backups you downloaded are your responsibility to keep.",
    linkTo: "/contact",
    linkLabel: "Contact support",
    audience: "all",
    topic: "support",
  },

  // —— Billing and Purchases ——
  {
    id: "pricing",
    question: "How much does SafetyPrepList cost?",
    answer: `Basic is ${money(BASIC_LICENSE_CENTS)} one time (core checklists on one device). Pro is ${money(PRO_LICENSE_CENTS)} one time and adds ${PRO_LISTS}. Checkout is handled securely by Stripe.`,
    linkTo: "/#pricing",
    linkLabel: "See plans",
    audience: "visitor",
    topic: "sales",
  },
  {
    id: "upgrade-how",
    question: "How do I upgrade from Basic to Pro?",
    answer: `After you activate a Basic license, open My license in the app and choose Upgrade to Pro. You keep the same license key. The upgrade is a one-time ${money(UPGRADE_TO_PRO_CENTS)} charge when you are eligible.`,
    linkTo: "/app/license",
    linkLabel: "Open My license",
    audience: "member",
    topic: "support",
  },
  {
    id: "upgrade-cost",
    question: "How much does upgrading cost?",
    answer: `An eligible Basic customer upgrades to Pro for ${money(UPGRADE_TO_PRO_CENTS)} one time. Buying Pro outright is ${money(PRO_LICENSE_CENTS)}. Your original Basic purchase stays in Purchase History.`,
    linkTo: "/license",
    linkLabel: "My license",
    audience: "all",
    topic: "support",
  },
  {
    id: "add-device",
    question: "How do I add another device?",
    answer: `One license covers one device. After you activate, open My license and use Add a Device for the in-app ${money(BASIC_ADDITIONAL_CENTS)} offer (a special price versus the regular ${money(BASIC_LICENSE_CENTS)} Basic license). That purchase creates a separate Basic license key for the additional device.`,
    linkTo: "/license",
    linkLabel: "My license",
    audience: "all",
    topic: "support",
  },
  {
    id: "receipts-where",
    question: "Where can I find my receipts?",
    answer:
      "Open My license in the app. Purchase History lists verified transactions for that license, including original purchases, upgrades, and additional-device purchases.",
    linkTo: "/app/license",
    linkLabel: "Open My license",
    audience: "member",
    topic: "support",
  },
  {
    id: "receipts-download",
    question: "How do I download a receipt?",
    answer:
      "On My license, open Purchase History and tap Download Receipt PDF next to a transaction. Each receipt is a branded SafetyPrepList PDF with the amount paid and available payment details from Stripe when that payment was processed there.",
    linkTo: "/app/license",
    linkLabel: "Open My license",
    audience: "member",
    topic: "support",
  },
  {
    id: "included",
    question: "What checklists are included?",
    answer: `Basic includes the ${CHECKLISTS}. Pro adds ${PRO_LISTS}. Check items off on the activated device, add notes, add up to 5 of your own items per section, and print or share lists.`,
    audience: "visitor",
    topic: "sales",
  },
  {
    id: "refund",
    question: "How do I request a refund?",
    answer: `${REFUND_RULE} Open Request a refund, explain why, and include your confirmation number when you have one.`,
    linkTo: "/contact?topic=refund",
    linkLabel: "Request a refund",
    audience: "all",
    topic: "support",
  },

  // —— Profile and Personalization ——
  {
    id: "profile-edit",
    question: "How do I edit my profile?",
    answer:
      "Open Profile in the app sidebar (under Help). First name, last name, and location are required. Changes save on this device only—no SafetyPrepList account login is required for your profile.",
    linkTo: "/app/profile",
    linkLabel: "Open Profile",
    audience: "member",
    topic: "support",
  },
  {
    id: "profile-photo",
    question: "How do I change my profile picture?",
    answer:
      "Open Profile, choose Upload photo or Change photo, then Save profile. The same picture (or your initials if you remove it) appears beside My Checklist, in the top-right corner, and on the homepage.",
    linkTo: "/app/profile",
    linkLabel: "Open Profile",
    audience: "member",
    topic: "support",
  },
  {
    id: "profile-location",
    question: "How do I update my location?",
    answer:
      "Open Profile and allow location access, or search for a city and state. Save your profile. Location is stored on this device and is used for local time, weather, and Safety Resources.",
    linkTo: "/app/profile",
    linkLabel: "Open Profile",
    audience: "member",
    topic: "support",
  },
  {
    id: "profile-why-location",
    question: "Why does SafetyPrepList need my location?",
    answer:
      "Location personalizes local time and time zone, today’s weather in the sidebar, and state-based Safety Resources. Checklists still work if you decline precise location—you can enter a city and state instead. Location is not required to open or edit checklists.",
    linkTo: "/app/profile",
    linkLabel: "Open Profile",
    audience: "member",
    topic: "support",
  },

  // —— Privacy and Data ——
  {
    id: "data-where",
    question: "Where is my checklist information stored?",
    answer:
      "Your personalized checklist progress, notes, contacts, and profile stay on this device. Purchase and license records are stored so we can activate keys and show receipts. Optional temporary cloud backups exist only if you create them during transfer.",
    audience: "all",
    topic: "support",
  },
  {
    id: "data-access",
    question: "Does SafetyPrepList have access to my personal checklist?",
    answer:
      "Day-to-day checklist contents live on your device, not as a required cloud account. If you create a temporary cloud backup and ask for help retrieving it while it is still available, authorized support may access that backup only to fulfill your request.",
    audience: "all",
    topic: "support",
  },
  {
    id: "data-cloud-after",
    question: "What happens to my cloud backup after 48 hours?",
    answer:
      "Temporary cloud backups are automatically deleted after 48 hours. After that, SafetyPrepList cannot retrieve that cloud copy. Keep a downloaded backup file if you need a longer-term copy.",
    audience: "all",
    topic: "support",
  },
  {
    id: "data-responsibility",
    question: "Who is responsible for backing up my data?",
    answer:
      "You are responsible for maintaining backups of checklist information on your device. Free downloadable and temporary cloud backups are a convenience. Do not deactivate or wipe a device until you have confirmed a backup you can restore.",
    linkTo: "/transfer",
    linkLabel: "Transfer / Deactivate",
    audience: "all",
    topic: "support",
  },

  // —— Everyday use ——
  {
    id: "offline",
    question: "How do I use my checklist offline?",
    answer:
      "After activation, your checklist is saved on this device and works without Wi-Fi or cell service. Purchases, activation, deactivation, recovery email, and cloud backup still need a connection.",
    linkTo: "/install",
    linkLabel: "Add the app icon",
    audience: "all",
    topic: "sales",
  },
  {
    id: "check-notes",
    question: "How do I check items off or add notes?",
    answer:
      "Open a list and tap the circle next to an item; checked items turn gray. Tap Add note on an item to leave a reminder, such as where something is stored.",
    audience: "member",
    topic: "support",
  },
  {
    id: "tour",
    question: "Can I see the guided tour again?",
    answer: "Yes. Open Help and choose Replay the guided tour anytime you want a walkthrough of the app.",
    linkTo: "/app/help",
    linkLabel: "Open Help",
    audience: "member",
    topic: "support",
  },
  {
    id: "sample",
    question: "Can I see a sample first?",
    answer: "Yes. Try a short sample from the 5-Minute Grab-and-Go Bag. Nothing you check in the sample is saved to a license.",
    linkTo: "/demo",
    linkLabel: "Try the sample",
    audience: "visitor",
    topic: "sales",
  },
];

export function supportFaqsForHelp(): SupportFaq[] {
  return SUPPORT_FAQS;
}

export function supportFaqsForChat(kind: "visitor" | "member"): SupportFaq[] {
  return SUPPORT_FAQS.filter((faq) => faq.audience === "all" || faq.audience === kind);
}
