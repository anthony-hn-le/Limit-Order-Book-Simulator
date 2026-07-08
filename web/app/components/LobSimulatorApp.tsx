"use client";

import { useEffect, useState } from "react";
import { useLobEngine } from "../lib/useLobEngine";
import { useAmbientFlow } from "../lib/useAmbientFlow";
import { useAccountLedger } from "../lib/useAccountLedger";
import type { BookSnapshot, TradeEvent } from "../lib/types";
import { OrderBookLadder } from "./OrderBookLadder";
import { TradeTape } from "./TradeTape";
import { OrderEntryPanel } from "./OrderEntryPanel";
import { DepthChart } from "./DepthChart";
import { RoleToggle, type Role } from "./RoleToggle";
import { InfoTrackers } from "./InfoTrackers";
import { AccountDashboard } from "./AccountDashboard";
import { OrderHistoryTable } from "./OrderHistoryTable";
import { MarketMakerPanel } from "./MarketMakerPanel";
import { PriceHistoryChart } from "./PriceHistoryChart";

const SNAPSHOT_DEPTH = 10;
const SNAPSHOT_POLL_MS = 150; // order books don't need 60fps; every poll crosses the WASM boundary
const MAX_TAPE_TRADES = 100;
const VISITOR_CLIENT_ID = 1000; // distinct from the ambient bot's client pool (1-20, see useAmbientFlow)
const INITIAL_CASH = 1_000_000;

interface Props {
  onReset: () => void;
}

export default function LobSimulatorApp({ onReset }: Props) {
  const { engineRef, ready } = useLobEngine();
  const [snapshot, setSnapshot] = useState<BookSnapshot | null>(null);
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [ambientSpeed, setAmbientSpeed] = useState(1);
  const [role, setRole] = useState<Role>("taker");

  useAmbientFlow(engineRef, ready, ambientEnabled, ambientSpeed);
  const ledger = useAccountLedger(engineRef, VISITOR_CLIENT_ID, INITIAL_CASH);

  useEffect(() => {
    if (!ready) return;
    const engine = engineRef.current;
    if (!engine) return;

    engine.setOnTrade((trade) => {
      setTrades((prev) => {
        const next = [trade, ...prev];
        return next.length > MAX_TAPE_TRADES ? next.slice(0, MAX_TAPE_TRADES) : next;
      });
      ledger.registerTradeForAttribution(trade);
    });

    const interval = setInterval(() => {
      setSnapshot(engine.getBookSnapshot(SNAPSHOT_DEPTH));
    }, SNAPSHOT_POLL_MS);

    return () => clearInterval(interval);
    // ledger.registerTradeForAttribution is individually stabilized via useCallback in
    // useAccountLedger; `ledger` itself is a fresh object every render, so depending on
    // the whole object here would re-subscribe setOnTrade and reset the poll interval
    // on every render instead of once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, engineRef, ledger.registerTradeForAttribution]);

  const lastPrice = trades.length > 0 ? trades[0].price : null;
  const bestBid = snapshot && snapshot.bidCount > 0 ? snapshot.bidPrice[0] : null;
  const bestAsk = snapshot && snapshot.askCount > 0 ? snapshot.askPrice[0] : null;
  const midPrice = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  const unrealizedPnl = ledger.unrealizedPnl(midPrice);
  const totalPnl = ledger.realizedPnl + unrealizedPnl;

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

      <div style={{ marginBottom: "1.5rem" }}>
        <RoleToggle role={role} onChange={setRole} onReset={onReset} disabled={!ready} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <InfoTrackers lastPrice={lastPrice} bestBid={bestBid} bestAsk={bestAsk} spread={spread} midPrice={midPrice} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <Card title="Order Book">
          <OrderBookLadder snapshot={snapshot} />
        </Card>
        <Card title="Depth Chart">
          <DepthChart snapshot={snapshot} />
        </Card>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 300px",
          gap: "1.5rem",
          marginBottom: "1.5rem",
          alignItems: "start",
        }}
      >
        <Card title="Trade Tape">
          <TradeTape trades={trades} />
        </Card>
        <Card title="Account">
          <AccountDashboard
            cash={ledger.cash}
            position={ledger.position}
            avgEntryPrice={ledger.avgEntryPrice}
            realizedPnl={ledger.realizedPnl}
            unrealizedPnl={unrealizedPnl}
            totalPnl={totalPnl}
            hasMidPrice={midPrice !== null}
          />
        </Card>
        <Card title={role === "taker" ? "Submit Order" : "Submit Quote"}>
          {role === "taker" ? (
            <OrderEntryPanel disabled={!ready} submitLimit={ledger.submitMyLimitOrder} submitMarket={ledger.submitMyMarketOrder} />
          ) : (
            <MarketMakerPanel disabled={!ready} onSubmitQuote={ledger.submitMyQuote} />
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <Card title="Order History">
          <OrderHistoryTable orders={ledger.orders} onCancel={ledger.cancelMyOrder} />
        </Card>
        <Card title="Price History">
          <PriceHistoryChart trades={trades} />
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
