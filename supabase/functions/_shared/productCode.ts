export function generateProductCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `RDM-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
