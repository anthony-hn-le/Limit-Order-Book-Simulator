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
import { ResetButton } from "./ResetButton";
import { BankruptcyModal } from "./BankruptcyModal";
import { Footer } from "./Footer";

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
  // Total account equity (cash plus the mark-to-market value of any open
  // position), not just raw cash -- a deeply underwater open position should
  // be able to trigger bankruptcy even if cash-in-hand is still positive.
  const accountBalance = INITIAL_CASH + totalPnl;
  // Bankruptcy must be a *sticky* latch, not a plain derived boolean: the
  // ambient bot keeps trading in the background (and any open position
  // keeps marking to market) even while the modal is up, so accountBalance
  // can drift back above zero on its own -- a plain `accountBalance < 0`
  // would make the modal silently vanish without Restart ever being
  // clicked. Latched via React's documented "adjust state during render"
  // pattern (not useEffect+setState, which would add an extra render pass
  // for no benefit and is what the linter flags as the anti-pattern here).
  // The triggering balance is frozen at the moment of bankruptcy too --
  // showing the live (possibly since-recovered) balance next to "dropped
  // below zero" would read as self-contradictory.
  const [bankruptAtBalance, setBankruptAtBalance] = useState<number | null>(null);
  if (accountBalance < 0 && bankruptAtBalance === null) {
    setBankruptAtBalance(accountBalance);
  }
  const isBankrupt = bankruptAtBalance !== null;

  return (
    <>
    <style jsx>{`
      /* Only grid-template-columns needs a breakpoint -- everything else
         (gap, margins, alignItems) stays as each div's original inline
         style, so these classes carry column widths only. */
      .lob-cols-role {
        grid-template-columns: 1fr auto;
      }
      .lob-cols-2 {
        grid-template-columns: 1fr 1fr;
      }
      .lob-cols-3 {
        grid-template-columns: 260px 1fr 300px;
      }
      @media (max-width: 700px) {
        .lob-cols-role,
        .lob-cols-2,
        .lob-cols-3 {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2.5rem 1.5rem", width: "100%" }}>
      <header style={{ marginBottom: "2rem" }}>
        <div className="mono" style={{ color: "var(--accent-cyan)", fontSize: "0.75rem", marginBottom: "0.4rem" }}>
          {ready ? "● ENGINE READY (WASM)" : "○ LOADING ENGINE..."}
        </div>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Limit Order Book Simulator
        </h1>
        <p className="mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
          Created by{" "}
          <a
            href="https://anthony-le.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent-cyan)", textDecoration: "none" }}
          >
            Anthony Le
          </a>
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.6rem" }}>
          A C++ price-time priority matching engine, compiled to WebAssembly and running entirely in your
          browser. A synthetic market maker keeps the book moving; submit your own order below to trade
          against it.
        </p>
      </header>

      <div
        className="card"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "1.1rem 1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--accent-cyan)",
            marginBottom: "0.75rem",
            textTransform: "uppercase",
          }}
        >
          Instructions
        </h2>
        <ul style={{ listStyle: "none", color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.7, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <InstructionItem>
            Start by picking a role:{" "}
            <strong style={{ color: "var(--text-primary)" }}>Market Taker</strong>{" "}
            buys and sells instantly against the book, while{" "}
            <strong style={{ color: "var(--text-primary)" }}>Market Maker</strong>{" "}
            lets you quote your own bid and ask. You may switch roles during the simulation, but both spend from the same wallet, which starts at $1,000,000.
          </InstructionItem>
          <InstructionItem>
            Track your <strong style={{ color: "var(--text-primary)" }}>Total PnL</strong>{" "}
            and{" "}
            <strong style={{ color: "var(--text-primary)" }}>Account Balance</strong>{" "}
            in the Account panel. Let your balance drop below zero and you&apos;re{" "}
            <strong style={{ color: "var(--accent-red)" }}>bankrupt</strong>. If that happens, the market won't care, and neither should you. Just hit{" "}
            <strong style={{ color: "var(--text-primary)" }}>Restart</strong>{" "}
            and try again with a clean slate.
          </InstructionItem>
          <InstructionItem>
            A synthetic market maker keeps the book alive in the background so there&apos;s always someone to
            trade against. If you&apos;d rather work with a frozen book, feel free to toggle it off.
          </InstructionItem>
        </ul>
      </div>

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

      <div className="lob-cols-role" style={{ display: "grid", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <RoleToggle role={role} onChange={setRole} disabled={!ready} />
        <ResetButton onReset={onReset} disabled={!ready} />
      </div>

      <div className="lob-cols-2" style={{ display: "grid", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <Card title="Order Book">
          <OrderBookLadder snapshot={snapshot} />
        </Card>
        <Card title="Depth Chart">
          <DepthChart snapshot={snapshot} />
        </Card>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <InfoTrackers lastPrice={lastPrice} bestBid={bestBid} bestAsk={bestAsk} spread={spread} midPrice={midPrice} />
      </div>

      <div
        className="lob-cols-3"
        style={{
          display: "grid",
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
            accountBalance={accountBalance}
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

      <div className="lob-cols-2" style={{ display: "grid", gap: "1.5rem" }}>
        <Card title="Order History">
          <OrderHistoryTable orders={ledger.orders} onCancel={ledger.cancelMyOrder} />
        </Card>
        <Card title="Price History">
          <PriceHistoryChart trades={trades} />
        </Card>
      </div>

    </div>
    <Footer />
    {isBankrupt && bankruptAtBalance !== null && (
      <BankruptcyModal accountBalance={bankruptAtBalance} onRestart={onReset} />
    )}
    </>
  );
}

function InstructionItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
      <span
        style={{
          flexShrink: 0,
          marginTop: "0.55em",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "var(--accent-cyan)",
          boxShadow: "0 0 6px var(--accent-cyan), 0 0 2px var(--accent-cyan)",
        }}
      />
      <span>{children}</span>
    </li>
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
