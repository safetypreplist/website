import { isSupabaseConfigured, supabase } from "./supabase";

export type PrintSource = "button" | "shortcut" | "browser";

export type RefundWindow = {
  firstPaidAt: string | null;
  refundableUntil: string | null;
  printedAt: string | null;
};

export const PRINT_REFUND_WARNING =
  "Refunds are available for 3 days after your first purchase, as long as no checklist has been printed or saved as a PDF. If you print now, your purchase will no longer be refundable.";

export async function recordPrint(list: string, source: PrintSource, blank = false) {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.rpc("record_print", { p_list: list, p_source: source, p_blank: blank });
  if (error) console.warn("Could not record print", error.message);
}

export async function loadRefundWindow(): Promise<RefundWindow | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.rpc("my_refund_window");
  if (error || !data) return null;
  const row = data as { first_paid_at: string | null; refundable_until: string | null; printed_at: string | null };
  return { firstPaidAt: row.first_paid_at, refundableUntil: row.refundable_until, printedAt: row.printed_at };
}

/** True while printing would still cost the customer their refund. */
export function printEndsRefund(refund: RefundWindow | null) {
  return Boolean(refund?.refundableUntil && !refund.printedAt && Date.parse(refund.refundableUntil) > Date.now());
}
