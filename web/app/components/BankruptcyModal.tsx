"use client";

import { formatCurrency } from "../lib/format";

interface Props {
  accountBalance: number;
  onRestart: () => void;
}

export function BankruptcyModal({ accountBalance, onRestart }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 5, 10, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1.5rem",
      }}
    >
      <div
        className="card"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--accent-red)",
          borderRadius: "14px",
          padding: "2rem",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 0 40px rgba(255, 74, 107, 0.2)",
        }}
      >
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💀</div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-red)", marginBottom: "0.75rem" }}>
          You Went Bankrupt
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "0.5rem" }}>
          Your account balance dropped below zero.
        </p>
        <p className="mono" style={{ color: "var(--accent-red)", fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          {formatCurrency(accountBalance)}
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mono"
          style={{
            padding: "0.75rem 2rem",
            borderRadius: "8px",
            border: "none",
            fontWeight: 800,
            fontSize: "1.05rem",
            background: "var(--accent-red)",
            color: "#1a0508",
            cursor: "pointer",
          }}
        >
          ↺ Restart
        </button>
      </div>
    </div>
  );
}
