// The only checklist content shipped in the public site. scripts/check-bundle.mjs allows text from this file
// and fails the build if any other paid checklist text appears in the bundle.

export type SampleItem = { id: string; text: string; description: string };
export type SampleSection = { id: string; title: string; intro: string; items: SampleItem[] };

export const SAMPLE_CHECKLIST: {
  title: string;
  description: string;
  sections: SampleSection[];
} = {
  title: "5-Minute Grab-and-Go Bag",
  description:
    "A backpack near the exit for when you need to leave. This is the minimum critical layer, not the whole preparedness system.",
  sections: [
    {
      id: "financial-id",
      title: "Identification & Money",
      intro: "One set per adult.",
      items: [
        {
          id: "grab.financial.wallet-id",
          text: "Driver's license or state ID",
          description: "Driver’s license or state ID. Keep it with cards and a little cash.",
        },
        { id: "grab.access.keys", text: "Keys", description: "House, car, storage unit, mailbox." },
        {
          id: "grab.financial.cards",
          text: "Payment card",
          description: "One debit and one credit you actually use. Write the bank’s phone number on paper too.",
        },
        { id: "grab.financial.cash", text: "Small amount of cash", description: "Small bills, for when cards do not work." },
        {
          id: "grab.documents.contact-list",
          text: "Emergency contacts",
          description: "Family, doctors, and one out-of-state contact. Laminate or bag it.",
        },
      ],
    },
    {
      id: "communication",
      title: "Communication & Light",
      intro: "Keep these charged and next to the door.",
      items: [
        {
          id: "grab.communication.phone",
          text: "Cell phone",
          description: "One per adult, fully charged, with important contacts saved on the device.",
        },
        {
          id: "grab.communication.powerbank",
          text: "Correct charging cable",
          description: "The cable that actually fits your phone.",
        },
        { id: "grab.communication.bank", text: "Compact power bank", description: "Charged, and small enough for the bag." },
        {
          id: "grab.survival.flashlight",
          text: "Small flashlight or headlamp",
          description: "Fresh batteries or a hand-crank option.",
        },
        {
          id: "grab.communication.whistle",
          text: "Whistle",
          description: "One you can reach without opening the whole bag.",
        },
      ],
    },
  ],
};
