import type { CSSProperties } from "react";

// Lifted out of OrderEntryPanel.tsx, now shared with RoleToggle.tsx.
export function toggleStyle(active: boolean, color: string): CSSProperties {
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
