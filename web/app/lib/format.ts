// Display-layer formatting only -- never fold rounding back into stored
// ledger state numbers (see useAccountLedger.ts), or rounding error would
// compound into realizedPnl/cash over a long session.

export function formatSigned(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : String(n);
}

export function formatCurrency(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function pnlColor(n: number): string {
  if (n > 0) return "var(--accent-green)";
  if (n < 0) return "var(--accent-red)";
  return "var(--text-secondary)";
}
