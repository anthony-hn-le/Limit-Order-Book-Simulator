import { formatCurrency, formatSigned, pnlColor } from "../lib/format";

interface Props {
  cash: number;
  position: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  hasMidPrice: boolean;
}

export function AccountDashboard({ cash, position, realizedPnl, unrealizedPnl, totalPnl, hasMidPrice }: Props) {
  const showUnrealized = hasMidPrice || position === 0;

  return (
    <div className="mono" style={{ display: "flex", flexDirection: "column", gap: "0.65rem", fontSize: "0.85rem" }}>
      <Row label="Cash" value={formatCurrency(cash)} color="var(--text-primary)" />
      <Row label="Position" value={formatSigned(position)} color="var(--text-primary)" />
      <Row label="Realized PnL" value={formatCurrency(realizedPnl)} color={pnlColor(realizedPnl)} />
      <Row
        label="Unrealized PnL"
        value={showUnrealized ? formatCurrency(unrealizedPnl) : "—"}
        color={showUnrealized ? pnlColor(unrealizedPnl) : "var(--text-muted)"}
      />
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.65rem" }}>
        <Row
          label="Total PnL"
          value={showUnrealized ? formatCurrency(totalPnl) : formatCurrency(realizedPnl)}
          color={showUnrealized ? pnlColor(totalPnl) : pnlColor(realizedPnl)}
          bold
        />
      </div>
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 700 : 600 }}>{value}</span>
    </div>
  );
}
