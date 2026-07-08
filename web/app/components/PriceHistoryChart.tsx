"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { TradeEvent } from "../lib/types";

// Single series (trade price over time) -- per the dataviz skill, a lone
// series needs no legend (the card title already says what's plotted) and
// takes one hue rather than a categorical assignment. Reuses --accent-cyan,
// already the app's convention for neutral/informational price readouts
// (the Mid-Price stat, the "engine ready" status line).

interface Props {
  trades: TradeEvent[]; // newest-first, as tracked by LobSimulatorApp
}

const WIDTH = 480;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 20, left: 44 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

export function PriceHistoryChart({ trades }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chronological = useMemo(() => [...trades].reverse(), [trades]);

  const model = useMemo(() => {
    if (chronological.length === 0) return null;

    const prices = chronological.map((t) => t.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = Math.max(1, maxPrice - minPrice);

    const xFor = (i: number) =>
      chronological.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i / (chronological.length - 1)) * PLOT_W;
    const yFor = (price: number) => PAD.top + PLOT_H - ((price - minPrice) / range) * PLOT_H;

    const linePath = chronological.map((t, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(t.price)}`).join(" ");
    const areaPath = `${linePath} L ${xFor(chronological.length - 1)} ${PAD.top + PLOT_H} L ${xFor(0)} ${PAD.top + PLOT_H} Z`;

    return { prices, minPrice, maxPrice, xFor, yFor, linePath, areaPath };
  }, [chronological]);

  if (!model) {
    return (
      <div className="mono" style={{ color: "var(--text-muted)", padding: "1rem", fontSize: "0.85rem" }}>
        No trades yet.
      </div>
    );
  }

  const { minPrice, maxPrice, xFor, yFor, linePath, areaPath } = model;

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const xInSvg = (e.clientX - rect.left) * scaleX;

    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < chronological.length; i++) {
      const d = Math.abs(xFor(i) - xInSvg);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  };

  const hoverTrade = hoverIdx !== null ? chronological[hoverIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="Traded price over time"
      >
        <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={WIDTH - PAD.right} y2={PAD.top + PLOT_H} stroke="var(--border)" strokeWidth={1} />

        <path d={areaPath} fill="var(--accent-cyan)" opacity={0.1} />
        <path d={linePath} fill="none" stroke="var(--accent-cyan)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hoverTrade && hoverIdx !== null && (
          <>
            <line
              x1={xFor(hoverIdx)}
              y1={PAD.top}
              x2={xFor(hoverIdx)}
              y2={PAD.top + PLOT_H}
              stroke="var(--text-muted)"
              strokeWidth={1}
            />
            <circle cx={xFor(hoverIdx)} cy={yFor(hoverTrade.price)} r={4} fill="var(--accent-cyan)" stroke="var(--bg-card)" strokeWidth={2} />
          </>
        )}

        <AxisLabel x={PAD.left - 6} y={PAD.top + 4} text={String(maxPrice)} anchor="end" />
        <AxisLabel x={PAD.left - 6} y={PAD.top + PLOT_H} text={String(minPrice)} anchor="end" />
      </svg>

      {hoverTrade && (
        <div
          className="mono"
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "0.4rem 0.6rem",
            fontSize: "0.72rem",
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{hoverTrade.price}</div>
          <div style={{ color: "var(--text-secondary)" }}>qty: {hoverTrade.quantity}</div>
        </div>
      )}
    </div>
  );
}

function AxisLabel({ x, y, text, anchor }: { x: number; y: number; text: string; anchor: "start" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={10} fill="var(--text-muted)" fontFamily="JetBrains Mono, monospace">
      {text}
    </text>
  );
}
