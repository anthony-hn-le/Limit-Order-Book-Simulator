interface Props {
  lastPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  midPrice: number | null;
}

export function InfoTrackers({ lastPrice, bestBid, bestAsk, spread, midPrice }: Props) {
  return (
    <div
      className="card"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "1rem",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "0.9rem 1rem",
      }}
    >
      <Stat label="LAST PRICE" value={lastPrice} color="var(--text-primary)" />
      <Stat label="BEST BID" value={bestBid} color="var(--accent-green)" />
      <Stat label="BEST ASK" value={bestAsk} color="var(--accent-red)" />
      <Stat label="SPREAD" value={spread} color="var(--text-primary)" />
      <Stat label="MID" value={midPrice} color="var(--accent-cyan)" />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: "1.1rem", fontWeight: 700, color: value === null ? "var(--text-muted)" : color }}>
        {value === null ? "—" : value}
      </div>
    </div>
  );
}
