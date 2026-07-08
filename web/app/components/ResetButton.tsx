"use client";

interface Props {
  onReset: () => void;
  disabled: boolean;
}

export function ResetButton({ onReset, disabled }: Props) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "0.75rem 1rem",
        height: "100%",
      }}
    >
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className="mono"
        style={{
          padding: "0.6rem 1.25rem",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: "0.85rem",
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          whiteSpace: "nowrap",
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
