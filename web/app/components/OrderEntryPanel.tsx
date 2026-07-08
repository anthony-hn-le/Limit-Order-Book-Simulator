"use client";

import { useState, type CSSProperties, type RefObject } from "react";
import { SIDE_BUY, SIDE_SELL } from "../lib/types";
import type { LobEngineHandle, SideValue } from "../lib/types";

interface Props {
  engineRef: RefObject<LobEngineHandle | null>;
  clientId: number;
  disabled: boolean;
}

export function OrderEntryPanel({ engineRef, clientId, disabled }: Props) {
  const [side, setSide] = useState<SideValue>(SIDE_BUY);
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("10000");
  const [quantity, setQuantity] = useState("10");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const submit = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;

    const sideLabel = side === SIDE_BUY ? "buy" : "sell";
    if (type === "market") {
      const id = engine.submitMarketOrder(side, qty, clientId);
      setLastResult(`Submitted market ${sideLabel} #${id}`);
    } else {
      const px = Number(price);
      if (!Number.isFinite(px) || px <= 0) return;
      const id = engine.submitLimitOrder(side, px, qty, clientId);
      setLastResult(`Submitted limit ${sideLabel} #${id} @ ${px}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={() => setSide(SIDE_BUY)} style={toggleStyle(side === SIDE_BUY, "var(--accent-green)")}>
          Buy
        </button>
        <button type="button" onClick={() => setSide(SIDE_SELL)} style={toggleStyle(side === SIDE_SELL, "var(--accent-red)")}>
          Sell
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={() => setType("limit")} style={toggleStyle(type === "limit", "var(--accent-cyan)")}>
          Limit
        </button>
        <button type="button" onClick={() => setType("market")} style={toggleStyle(type === "market", "var(--accent-cyan)")}>
          Market
        </button>
      </div>
      {type === "limit" && (
        <div>
          <label htmlFor="order-price">Price (ticks)</label>
          <input id="order-price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
        </div>
      )}
      <div>
        <label htmlFor="order-quantity">Quantity</label>
        <input id="order-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
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
          background: side === SIDE_BUY ? "var(--accent-green)" : "var(--accent-red)",
          color: "#04101a",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {disabled ? "Loading engine..." : `Submit ${type === "limit" ? "Limit" : "Market"} ${side === SIDE_BUY ? "Buy" : "Sell"}`}
      </button>
      {lastResult && (
        <div className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {lastResult}
        </div>
      )}
    </div>
  );
}

function toggleStyle(active: boolean, color: string): CSSProperties {
  return {
    flex: 1,
    padding: "0.5rem",
    borderRadius: "6px",
    border: `1px solid ${active ? color : "var(--border)"}`,
    background: active ? `color-mix(in srgb, ${color} 15%, transparent)` : "transparent",
    color: active ? color : "var(--text-secondary)",
    fontWeight: 600,
    cursor: "pointer",
  };
}
