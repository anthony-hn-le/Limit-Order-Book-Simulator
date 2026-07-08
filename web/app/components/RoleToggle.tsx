"use client";

import { toggleStyle } from "../lib/uiStyle";

export type Role = "taker" | "maker";

interface Props {
  role: Role;
  onChange: (role: Role) => void;
  onReset: () => void;
  disabled: boolean;
}

export function RoleToggle({ role, onChange, onReset, disabled }: Props) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "0.75rem 1rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          ROLE
        </span>
        <div style={{ display: "flex", gap: "0.5rem", width: "300px" }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("taker")}
            style={{ ...toggleStyle(role === "taker", "var(--accent-cyan)"), opacity: disabled ? 0.5 : 1 }}
          >
            Market Taker
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("maker")}
            style={{ ...toggleStyle(role === "maker", "var(--accent-cyan)"), opacity: disabled ? 0.5 : 1 }}
          >
            Market Maker
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className="mono"
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: "0.78rem",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.color = "var(--accent-red)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
        title="Reset the engine, order book, and your account back to a fresh start"
      >
        ↺ Reset
      </button>
    </div>
  );
}
