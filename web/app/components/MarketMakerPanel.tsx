"use client";

import { useState } from "react";

interface Props {
  onSubmitQuote: (bidPrice: number, bidQty: number, askPrice: number, askQty: number) => void;
  disabled: boolean;
}

export function MarketMakerPanel({ onSubmitQuote, disabled }: Props) {
  const [bidPrice, setBidPrice] = useState("9995");
  const [askPrice, setAskPrice] = useState("10005");
  const [bidSize, setBidSize] = useState("10");
  const [askSize, setAskSize] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const bp = Number(bidPrice);
    const ap = Number(askPrice);
    const bq = Number(bidSize);
    const aq = Number(askSize);

    if (![bp, ap, bq, aq].every((n) => Number.isFinite(n) && n > 0)) {
      setError("All fields must be positive numbers.");
      return;
    }
    if (!(bp < ap)) {
      setError("Bid price must be less than ask price.");
      return;
    }
    setError(null);
    onSubmitQuote(bp, bq, ap, aq);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="mm-bid-price">Bid Price</label>
          <input id="mm-bid-price" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} inputMode="numeric" />
        </div>
        <span className="mono" style={{ paddingBottom: "0.6rem", color: "var(--text-muted)" }}>
          @
        </span>
        <div style={{ flex: 1 }}>
          <label htmlFor="mm-ask-price">Ask Price</label>
          <input id="mm-ask-price" value={askPrice} onChange={(e) => setAskPrice(e.target.value)} inputMode="numeric" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="mm-bid-size">Bid Size</label>
          <input id="mm-bid-size" value={bidSize} onChange={(e) => setBidSize(e.target.value)} inputMode="numeric" />
        </div>
        <span className="mono" style={{ paddingBottom: "0.6rem", color: "var(--text-muted)" }}>
          by
        </span>
        <div style={{ flex: 1 }}>
          <label htmlFor="mm-ask-size">Ask Size</label>
          <input id="mm-ask-size" value={askSize} onChange={(e) => setAskSize(e.target.value)} inputMode="numeric" />
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        style={{
          padding: "0.65rem 1rem",
          borderRadius: "8px",
          border: "none",
          fontWeight: 700,
          background: "var(--accent-cyan)",
          color: "#04101a",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {disabled ? "Loading engine..." : "Submit Quote"}
      </button>

      {error && (
        <div className="mono" style={{ fontSize: "0.75rem", color: "var(--accent-red)" }}>
          {error}
        </div>
      )}

      <div className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
        Submitting replaces your previous pending quote. A crossing order against your own resting quote is
        blocked by self-trade prevention, not matched.
      </div>
    </div>
  );
}
