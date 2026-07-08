"use client";

import { toggleStyle } from "../lib/uiStyle";

export type Role = "taker" | "maker";

interface Props {
  role: Role;
  onChange: (role: Role) => void;
  disabled: boolean;
}

export function RoleToggle({ role, onChange, disabled }: Props) {
  return (
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
        flexWrap: "wrap",
        height: "100%",
      }}
    >
      <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
        ROLE
      </span>
      <div style={{ display: "flex", gap: "0.75rem", flex: "1 1 320px" }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("taker")}
          style={{
            ...toggleStyle(role === "taker", "var(--accent-cyan)"),
            padding: "0.9rem 1rem",
            fontSize: "1.05rem",
            fontWeight: 800,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Market Taker
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("maker")}
          style={{
            ...toggleStyle(role === "maker", "var(--accent-cyan)"),
            padding: "0.9rem 1rem",
            fontSize: "1.05rem",
            fontWeight: 800,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Market Maker
        </button>
      </div>
    </div>
  );
}
