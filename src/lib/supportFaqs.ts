import { money } from "./format";
import type { ChatTopic } from "./liveAgent";
import { BASIC_LICENSE_CENTS, PRO_LICENSE_CENTS, UPGRADE_TO_PRO_CENTS } from "./pricing";

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
      "Open Activate, enter the license key from your purchase email, and tap Activate on this device. If the license is in use on another device, Activate shows you how to move it here.",
    linkTo: "/activate",
    linkLabel: "Activate",
    audience: "all",
    topic: "support",
  },
  {
    id: "activate-fail",
    question: "I can't activate my license.",
    answer:
      "Check that the key matches your purchase email. If Activate says the license is in use on another device, open Safety Prep List on that device and choose Move to a new device — or, if you can't use that device, tap Email me a link on this one. Activation needs an internet connection.",
    linkTo: "/activate",
    linkLabel: "Activate",
    audience: "all",
    topic: "support",
  },
  {
    id: "lost-key",
    question: "I lost my license key.",
    answer:
      "Tap Forgot your key and enter the email from your original purchase. We send a secure one-time link that shows your key.",
    linkTo: "/license-recovery",
    linkLabel: "Find my key",
    audience: "all",
    topic: "support",
  },
  {
    id: "recover-license",
    question: "How do I recover my license?",
    answer:
      "Tap Forgot your key, enter your purchase email, and open the secure link we send. It shows your license key so you can activate it. We never put the key itself in that first email—only the link.",
    linkTo: "/license-recovery",
    linkLabel: "Find my key",
    audience: "all",
    topic: "support",
  },
  {
    id: "move-license",
    question: "How do I move my license to another device?",
    answer:
      "On the device you use now, open Move to a new device (on a phone: More → Move to a new device) and tap Back up and move. Then scan the code or open the link on the new device, tap Activate, and tap Restore my checklist. Old device lost or broken? Enter your key on the new device and tap Email me a link.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
    audience: "all",
    topic: "support",
  },
  {
    id: "deactivate",
    question: "How do I free my license from a device?",
    answer:
      "Move to a new device does it for you: it backs up your checklist and frees the license in one step. If you can't use the old device, enter your key on the new one and tap Email me a link — opening that link frees the license. Checklists stay on the old device unless you restore a backup.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
    audience: "all",
    topic: "support",
  },

  // —— Backups and Transfers ——
  {
    id: "backup-how",
    question: "How do I back up my checklist?",
    answer:
      "Back up and move (under Move to a new device) makes a free 48-hour cloud backup automatically. To keep your own copy at any time, open Move to a new device → Other backup options → Save a backup file.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
    audience: "member",
    topic: "support",
  },
  {
    id: "backup-cloud-free",
    question: "Is cloud backup free?",
    answer:
      "Yes. The 48-hour cloud backup made when you move to a new device is free. It is for moving devices, not permanent storage.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
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
      "Open Move to a new device → Other backup options → Save a backup file, and keep the file somewhere your new device can open. On the new device, use Restore from a file in the same place.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
    audience: "member",
    topic: "support",
  },
  {
    id: "transfer-checklist",
    question: "How do I get my checklist onto another device?",
    answer:
      "Use Move to a new device. It backs up your checklist, and the new device offers Restore my checklist right after you activate. Cloud backups last 48 hours; a saved backup file lasts as long as you keep it.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
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
    question: "How do I use Safety Prep List on another device?",
    answer:
      "One license covers one device. Use Move to a new device to switch to a replacement device, or buy another Basic or Pro license for a second device. Optional Group Sharing lets licensed devices sync temporarily online.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
    audience: "all",
    topic: "support",
  },
  {
    id: "receipts-where",
    question: "Where can I find my receipts?",
    answer:
      "Open My license in the app. Purchase History lists verified transactions for that license, including original purchases, upgrades, and Group Sharing purchases.",
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
    answer: `Basic includes the ${CHECKLISTS}. Pro adds ${PRO_LISTS}. Check items off on the activated device, add notes, and add up to 5 of your own items per section.`,
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
      "Open Profile in the app sidebar (under More on phones). First and last name are required; location is optional. Changes save on this device only—there is no SafetyPrepList login for your profile.",
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
      "You are responsible for maintaining backups of checklist information on your device. Free downloadable and temporary cloud backups are a convenience. Do not wipe or give away a device until you have confirmed a backup you can restore.",
    linkTo: "/app/transfer",
    linkLabel: "Move to a new device",
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
