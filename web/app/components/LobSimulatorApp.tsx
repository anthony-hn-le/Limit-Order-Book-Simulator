"use client";

import { useEffect, useState } from "react";
import { useLobEngine } from "../lib/useLobEngine";
import type { BookSnapshot, TradeEvent } from "../lib/types";
import { OrderBookLadder } from "./OrderBookLadder";
import { TradeTape } from "./TradeTape";
import { OrderEntryPanel } from "./OrderEntryPanel";

const SNAPSHOT_DEPTH = 10;
const SNAPSHOT_POLL_MS = 150; // order books don't need 60fps; every poll crosses the WASM boundary
const MAX_TAPE_TRADES = 100;
const VISITOR_CLIENT_ID = 1000; // distinct from any ambient-bot client id (see Phase 8)

export default function LobSimulatorApp() {
  const { engineRef, ready } = useLobEngine();
  const [snapshot, setSnapshot] = useState<BookSnapshot | null>(null);
  const [trades, setTrades] = useState<TradeEvent[]>([]);

  useEffect(() => {
    if (!ready) return;
    const engine = engineRef.current;
    if (!engine) return;

    engine.setOnTrade((trade) => {
      setTrades((prev) => {
        const next = [trade, ...prev];
        return next.length > MAX_TAPE_TRADES ? next.slice(0, MAX_TAPE_TRADES) : next;
      });
    });

    const interval = setInterval(() => {
      setSnapshot(engine.getBookSnapshot(SNAPSHOT_DEPTH));
    }, SNAPSHOT_POLL_MS);

    return () => clearInterval(interval);
  }, [ready, engineRef]);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2.5rem 1.5rem", width: "100%" }}>
      <header style={{ marginBottom: "2rem" }}>
        <div className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
          {ready ? "● ENGINE READY (WASM)" : "○ LOADING ENGINE..."}
        </div>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Limit Order Book Simulator
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.4rem" }}>
          A C++ price-time priority matching engine, compiled to WebAssembly and running entirely in your
          browser. Submit an order below.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 260px", gap: "1.5rem", alignItems: "start" }}>
        <div className="card" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem" }}>
          <SectionTitle>Order Book</SectionTitle>
          <OrderBookLadder snapshot={snapshot} />
        </div>

        <div className="card" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem" }}>
          <SectionTitle>Trade Tape</SectionTitle>
          <TradeTape trades={trades} />
        </div>

        <div className="card" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem" }}>
          <SectionTitle>Submit Order</SectionTitle>
          <OrderEntryPanel engineRef={engineRef} clientId={VISITOR_CLIENT_ID} disabled={!ready} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
        marginBottom: "0.9rem",
        textTransform: "uppercase",
      }}
    >
      {children}
    </h2>
  );
}
