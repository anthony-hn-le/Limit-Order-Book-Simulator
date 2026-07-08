"use client";

import { useEffect, useState } from "react";
import { useLobEngine } from "../lib/useLobEngine";
import { useAmbientFlow } from "../lib/useAmbientFlow";
import type { BookSnapshot, TradeEvent } from "../lib/types";
import { OrderBookLadder } from "./OrderBookLadder";
import { TradeTape } from "./TradeTape";
import { OrderEntryPanel } from "./OrderEntryPanel";
import { DepthChart } from "./DepthChart";

const SNAPSHOT_DEPTH = 10;
const SNAPSHOT_POLL_MS = 150; // order books don't need 60fps; every poll crosses the WASM boundary
const MAX_TAPE_TRADES = 100;
const VISITOR_CLIENT_ID = 1000; // distinct from the ambient bot's client pool (1-20, see useAmbientFlow)

export default function LobSimulatorApp() {
  const { engineRef, ready } = useLobEngine();
  const [snapshot, setSnapshot] = useState<BookSnapshot | null>(null);
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [ambientSpeed, setAmbientSpeed] = useState(1);

  useAmbientFlow(engineRef, ready, ambientEnabled, ambientSpeed);

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
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 1.5rem", width: "100%" }}>
      <header style={{ marginBottom: "2rem" }}>
        <div className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
          {ready ? "● ENGINE READY (WASM)" : "○ LOADING ENGINE..."}
        </div>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Limit Order Book Simulator
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.4rem" }}>
          A C++ price-time priority matching engine, compiled to WebAssembly and running entirely in your
          browser. A synthetic market maker keeps the book moving; submit your own order below to trade
          against it.
        </p>
      </header>

      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setAmbientEnabled((v) => !v)}
          disabled={!ready}
          className="mono"
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: "6px",
            border: `1px solid ${ambientEnabled ? "var(--accent-cyan)" : "var(--border)"}`,
            background: ambientEnabled ? "color-mix(in srgb, var(--accent-cyan) 12%, transparent)" : "transparent",
            color: ambientEnabled ? "var(--accent-cyan)" : "var(--text-secondary)",
            fontSize: "0.78rem",
            cursor: ready ? "pointer" : "not-allowed",
          }}
        >
          {ambientEnabled ? "● Ambient flow: ON" : "○ Ambient flow: OFF"}
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, flex: "1 1 200px" }}>
          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            SPEED {ambientSpeed.toFixed(1)}x
          </span>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.25}
            value={ambientSpeed}
            onChange={(e) => setAmbientSpeed(Number(e.target.value))}
            style={{ width: "auto", flex: 1 }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <Card title="Order Book">
          <OrderBookLadder snapshot={snapshot} />
        </Card>
        <Card title="Depth Chart">
          <DepthChart snapshot={snapshot} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem" }}>
        <Card title="Trade Tape">
          <TradeTape trades={trades} />
        </Card>
        <Card title="Submit Order">
          <OrderEntryPanel engineRef={engineRef} clientId={VISITOR_CLIENT_ID} disabled={!ready} />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="card"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem" }}
    >
      <SectionTitle>{title}</SectionTitle>
      {children}
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
