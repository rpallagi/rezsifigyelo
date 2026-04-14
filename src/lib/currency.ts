/**
 * Convert an amount to HUF using the EUR exchange rate.
 */
export function toHuf(amount: number, currency: string | null | undefined, eurRate: number): number {
  return currency === "EUR" ? amount * eurRate : amount;
}

/**
 * Format an amount with the correct currency symbol.
 */
export function formatAmount(amount: number, currency: string | null | undefined): string {
  return `${Math.round(amount).toLocaleString("hu-HU")} ${currency === "EUR" ? "€" : "Ft"}`;
}

/**
 * Get the currency symbol.
 */
export function currencySymbol(currency: string | null | undefined): string {
  return currency === "EUR" ? "€" : "Ft";
}
