import type { BookSnapshot } from "../lib/types";
import type { CSSProperties } from "react";

interface Level {
  price: number;
  qty: number;
}

interface Props {
  snapshot: BookSnapshot | null;
}

export function OrderBookLadder({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <div className="mono" style={{ color: "var(--text-muted)", padding: "1rem", fontSize: "0.85rem" }}>
        Loading order book...
      </div>
    );
  }

  const bids: Level[] = Array.from({ length: snapshot.bidCount }, (_, i) => ({
    price: snapshot.bidPrice[i],
    qty: snapshot.bidQty[i],
  }));
  const asks: Level[] = Array.from({ length: snapshot.askCount }, (_, i) => ({
    price: snapshot.askPrice[i],
    qty: snapshot.askQty[i],
  }));

  const maxQty = Math.max(1, ...bids.map((b) => b.qty), ...asks.map((a) => a.qty));
  const rows = Math.max(bids.length, asks.length);

  return (
    <div className="mono" style={{ fontSize: "0.82rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          color: "var(--text-muted)",
          fontSize: "0.7rem",
          marginBottom: "0.4rem",
          letterSpacing: "0.05em",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>BID QTY</span>
          <span>BID PX</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ASK PX</span>
          <span>ASK QTY</span>
        </div>
      </div>
      {rows === 0 && (
        <div style={{ color: "var(--text-muted)", padding: "0.5rem 0" }}>Book is empty.</div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "2px" }}
        >
          <Row value={bids[i]} color="var(--accent-green)" priceOnLeft={false} maxQty={maxQty} />
          <Row value={asks[i]} color="var(--accent-red)" priceOnLeft={true} maxQty={maxQty} />
        </div>
      ))}
    </div>
  );
}

function Row({
  value,
  color,
  priceOnLeft,
  maxQty,
}: {
  value?: Level;
  color: string;
  priceOnLeft: boolean;
  maxQty: number;
}) {
  if (!value) return <div style={{ height: "1.5rem" }} />;
  const pct = Math.min(100, (value.qty / maxQty) * 100);

  const barStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    bottom: 0,
    [priceOnLeft ? "left" : "right"]: 0,
    width: `${pct}%`,
    background: color,
    opacity: 0.15,
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "space-between",
        gap: "0.5rem",
        padding: "0.2rem 0.5rem",
        overflow: "hidden",
      }}
    >
      <div style={barStyle} />
      {priceOnLeft ? (
        <>
          <span style={{ position: "relative", color, fontWeight: 600 }}>{value.price}</span>
          <span style={{ position: "relative", color: "var(--text-secondary)" }}>{value.qty}</span>
        </>
      ) : (
        <>
          <span style={{ position: "relative", color: "var(--text-secondary)" }}>{value.qty}</span>
          <span style={{ position: "relative", color, fontWeight: 600 }}>{value.price}</span>
        </>
      )}
    </div>
  );
}
