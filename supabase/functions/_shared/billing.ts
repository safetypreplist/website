export type AccessInterval = "monthly" | "annual";

export function parseAccessInterval(value: unknown): AccessInterval | null {
  if (value === "annual" || value === "y") return "annual";
  if (value === "monthly" || value === "m") return "monthly";
  return null;
}

export function accessToken(interval: AccessInterval) {
  return interval === "annual" ? "y" : "m";
}

export function buildCustomId(args: {
  slug: string;
  quantity: number;
  includeHousehold: boolean;
  access: AccessInterval | null;
  discountCode?: string;
}) {
  const access = args.access ? `|a=${accessToken(args.access)}` : "";
  const discount = args.discountCode ? `|d=${args.discountCode}` : "";
  return `${args.slug}|q=${args.quantity}|h=${args.includeHousehold ? 1 : 0}${access}${discount}`;
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function renewalLine(
  access: AccessInterval,
  subscriptionCents: number,
  discountCents: number,
  discountPayments: number,
  includeVault: boolean,
) {
  const unit = access === "annual" ? "year" : "month";
  const cadence = access === "annual" ? "annual" : "monthly";
  const remaining = discountPayments - 1;
  const base = discountCents > 0 && remaining > 0
    ? remaining === 1
      ? `Your next ${cadence} payment is ${dollars(subscriptionCents - discountCents)}, then ${dollars(subscriptionCents)} per ${unit}.`
      : `Your next ${remaining} ${cadence} payments are ${dollars(subscriptionCents - discountCents)} each, then ${dollars(subscriptionCents)} per ${unit}.`
    : `Renews ${access === "annual" ? "annually" : "monthly"} at ${dollars(subscriptionCents)}.`;
  return includeVault ? `${base} Survival Vault does not renew.` : base;
}

export function parseCustomId(customId: string, fallbackSlug: string) {
  const slug = customId.split("|")[0] || fallbackSlug;
  const qtyMatch = customId.match(/q=(\d+)/);
  const accessMatch = customId.match(/a=([my])/);
  const discountMatch = customId.match(/d=([A-Z0-9]+)/);
  return {
    slug,
    quantity: Math.max(1, Number(qtyMatch?.[1] || 1) || 1),
    includeHousehold: /h=1/.test(customId),
    access: parseAccessInterval(accessMatch?.[1] || null),
    discountCode: discountMatch?.[1] || "",
  };
}
