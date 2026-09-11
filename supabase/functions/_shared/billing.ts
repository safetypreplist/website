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
}) {
  const access = args.access ? `|a=${accessToken(args.access)}` : "";
  return `${args.slug}|q=${args.quantity}|h=${args.includeHousehold ? 1 : 0}${access}`;
}

export function parseCustomId(customId: string, fallbackSlug: string) {
  const slug = customId.split("|")[0] || fallbackSlug;
  const qtyMatch = customId.match(/q=(\d+)/);
  const accessMatch = customId.match(/a=([my])/);
  return {
    slug,
    quantity: Math.max(1, Number(qtyMatch?.[1] || 1) || 1),
    includeHousehold: /h=1/.test(customId),
    access: parseAccessInterval(accessMatch?.[1] || null),
  };
}
