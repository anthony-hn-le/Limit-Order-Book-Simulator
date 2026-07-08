"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type { BookSnapshot } from "../lib/types";

// Depth chart: two categorical series (bids/asks), not a statistical
// diverging measure -- see the dataviz skill's choosing-a-form guidance.
// Colors reuse the site's existing --accent-green/--accent-red brand
// tokens rather than a chart-specific palette (they're used elsewhere
// across the sibling projects, e.g. Implied-Volatility-Surface). The
// palette validator flags them as slightly too light for the dark-mode
// lightness band as *solid fills* -- mitigated per marks-and-anatomy.md's
// own area-fill spec (~10% opacity wash, never a saturated block) and by
// using full saturation only for the 2px stroke/labels/legend, where CVD
// separation, chroma, and contrast all pass. Bright green/red bid/ask is
// also the universal trading-terminal convention this app is imitating.

interface Props {
  snapshot: BookSnapshot | null;
}

interface Point {
  price: number;
  cumQty: number;
}

const WIDTH = 480;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 16 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

function buildCumulative(prices: Float64Array, qtys: Float64Array, count: number): Point[] {
  const points: Point[] = [];
  let cum = 0;
  for (let i = 0; i < count; i++) {
    cum += qtys[i];
    points.push({ price: prices[i], cumQty: cum });
  }
  return points;
}

export function DepthChart({ snapshot }: Props) {
  const [hover, setHover] = useState<{ clientX: number; point: Point; side: "bid" | "ask" } | null>(null);

  const model = useMemo(() => {
    if (!snapshot || (snapshot.bidCount === 0 && snapshot.askCount === 0)) return null;

    // bidPoints/askPoints come in best-to-worst order from the engine
    // (descending price for bids, ascending for asks). Reversed for bids
    // so both arrays read left-to-right in increasing price -- the
    // cumulative depth is smallest right at the spread and grows outward
    // on both sides, the standard order-book depth-chart shape.
    const bidsBestFirst = buildCumulative(snapshot.bidPrice, snapshot.bidQty, snapshot.bidCount);
    const asks = buildCumulative(snapshot.askPrice, snapshot.askQty, snapshot.askCount);
    const bids = [...bidsBestFirst].reverse();

    const maxCum = Math.max(1, bidsBestFirst.at(-1)?.cumQty ?? 0, asks.at(-1)?.cumQty ?? 0);
    const minPrice = bids[0]?.price ?? asks[0]?.price ?? 0;
    const maxPrice = asks.at(-1)?.price ?? bids.at(-1)?.price ?? minPrice + 1;
    const priceRange = Math.max(1, maxPrice - minPrice);

    const priceToX = (p: number) => PAD.left + ((p - minPrice) / priceRange) * PLOT_W;
    const qtyToY = (q: number) => PAD.top + PLOT_H - (q / maxCum) * PLOT_H;
    const baselineY = PAD.top + PLOT_H;

    const areaPath = (points: Point[]) => {
      if (points.length === 0) return "";
      const first = `M ${priceToX(points[0].price)} ${baselineY} L ${priceToX(points[0].price)} ${qtyToY(points[0].cumQty)}`;
      const rest = points.slice(1).map((p) => `L ${priceToX(p.price)} ${qtyToY(p.cumQty)}`).join(" ");
      const last = points[points.length - 1];
      return `${first} ${rest} L ${priceToX(last.price)} ${baselineY} Z`;
    };

    const linePath = (points: Point[]) =>
      points.map((p, i) => `${i === 0 ? "M" : "L"} ${priceToX(p.price)} ${qtyToY(p.cumQty)}`).join(" ");

    return { bids, asks, maxCum, minPrice, maxPrice, priceToX, qtyToY, baselineY, areaPath, linePath };
  }, [snapshot]);

  if (!model) {
    return (
      <div className="mono" style={{ color: "var(--text-muted)", padding: "1rem", fontSize: "0.85rem" }}>
        No depth to show yet.
      </div>
    );
  }

  const { bids, asks, priceToX, baselineY, areaPath, linePath, minPrice, maxPrice } = model;

  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const xInSvg = (e.clientX - rect.left) * scaleX;

    const all: { point: Point; side: "bid" | "ask" }[] = [
      ...bids.map((p) => ({ point: p, side: "bid" as const })),
      ...asks.map((p) => ({ point: p, side: "ask" as const })),
    ];
    if (all.length === 0) return;

    let nearest = all[0];
    let best = Infinity;
    for (const entry of all) {
      const d = Math.abs(priceToX(entry.point.price) - xInSvg);
      if (d < best) {
        best = d;
        nearest = entry;
      }
    }
    setHover({ clientX: e.clientX, point: nearest.point, side: nearest.side });
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem", fontSize: "0.72rem" }} className="mono">
        <LegendKey color="var(--accent-green)" label="Bids" />
        <LegendKey color="var(--accent-red)" label="Asks" />
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Cumulative order book depth by price"
      >
        {/* recessive baseline */}
        <line x1={PAD.left} y1={baselineY} x2={WIDTH - PAD.right} y2={baselineY} stroke="var(--border)" strokeWidth={1} />

        <path d={areaPath(bids)} fill="var(--accent-green)" opacity={0.12} />
        <path d={areaPath(asks)} fill="var(--accent-red)" opacity={0.12} />
        <path d={linePath(bids)} fill="none" stroke="var(--accent-green)" strokeWidth={2} strokeLinejoin="round" />
        <path d={linePath(asks)} fill="none" stroke="var(--accent-red)" strokeWidth={2} strokeLinejoin="round" />

        {hover && (
          <line
            x1={priceToX(hover.point.price)}
            y1={PAD.top}
            x2={priceToX(hover.point.price)}
            y2={baselineY}
            stroke="var(--text-muted)"
            strokeWidth={1}
          />
        )}

        {/* price axis labels: low, spread edges, high -- selective, not every level */}
        <AxisLabel x={priceToX(minPrice)} y={HEIGHT - 8} text={String(minPrice)} anchor="start" />
        <AxisLabel x={priceToX(maxPrice)} y={HEIGHT - 8} text={String(maxPrice)} anchor="end" />
      </svg>

      {hover && (
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
          <div style={{ color: hover.side === "bid" ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>
            {hover.point.price}
          </div>
          <div style={{ color: "var(--text-secondary)" }}>depth: {hover.point.cumQty}</div>
        </div>
      )}
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <span style={{ width: "12px", height: "2px", background: color, display: "inline-block" }} />
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
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
