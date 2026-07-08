import type { TradeEvent } from "../lib/types";

interface Props {
  trades: TradeEvent[];
}

export function TradeTape({ trades }: Props) {
  return (
    <div className="mono" style={{ fontSize: "0.78rem", maxHeight: "280px", overflowY: "auto" }}>
      {trades.length === 0 && (
        <div style={{ color: "var(--text-muted)", padding: "0.5rem 0" }}>No trades yet.</div>
      )}
      {trades.map((t, i) => (
        <div
          key={`${t.id}-${i}`}
          style={{
            display: "grid",
            gridTemplateColumns: "3rem 1fr 1fr",
            padding: "0.25rem 0",
            borderBottom: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <span>#{t.id}</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{t.price}</span>
          <span style={{ textAlign: "right" }}>{t.quantity}</span>
        </div>
      ))}
    </div>
  );
}
