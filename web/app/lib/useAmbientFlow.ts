"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { SIDE_BUY, SIDE_SELL } from "./types";
import type { LobEngineHandle } from "./types";

// TS reimplementation of the C++ OrderFlowGenerator's Poisson/random-walk
// logic (see engine/src/order_flow_generator.cpp) -- doesn't need to share
// the C++ implementation, since it drives the engine through the same
// public submit/cancel API a human visitor uses. Runs so the book looks
// alive with zero visitor interaction.
//
// Uses a pool of client ids distinct from the visitor's (see
// VISITOR_CLIENT_ID in LobSimulatorApp.tsx) so the visitor's own orders
// can actually cross against ambient liquidity instead of hitting
// self-trade prevention every time.

const AMBIENT_CLIENT_POOL_SIZE = 20;
const AMBIENT_CLIENT_BASE = 1; // ids 1..20; visitor uses 1000, so no overlap
const BASE_INTERVAL_MS = 220;
const MIN_QTY = 1;
const MAX_QTY = 40;
const SPREAD_TICKS = 5;
const JUMP_PROBABILITY = 0.02;
const JUMP_SIZE = 20;
const MARKET_ORDER_PROBABILITY = 0.08;
const CANCEL_PROBABILITY = 0.15;
const MAX_TRACKED_IDS = 500;

export function useAmbientFlow(
  engineRef: RefObject<LobEngineHandle | null>,
  ready: boolean,
  enabled: boolean,
  speedMultiplier: number,
) {
  const midPriceRef = useRef(10000);
  const liveIdsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!ready || !enabled) return;
    const engine = engineRef.current;
    if (!engine) return;

    const tick = () => {
      const jump = Math.random() < JUMP_PROBABILITY ? JUMP_SIZE : 1;
      midPriceRef.current += Math.random() < 0.5 ? -jump : jump;
      if (midPriceRef.current < SPREAD_TICKS + 1) midPriceRef.current = SPREAD_TICKS + 1;

      if (Math.random() < CANCEL_PROBABILITY && liveIdsRef.current.length > 0) {
        const idx = Math.floor(Math.random() * liveIdsRef.current.length);
        const id = liveIdsRef.current[idx];
        if (engine.cancelOrder(id)) {
          liveIdsRef.current.splice(idx, 1);
        }
        return;
      }

      const side = Math.random() < 0.5 ? SIDE_BUY : SIDE_SELL;
      const qty = Math.floor(MIN_QTY + Math.random() * (MAX_QTY - MIN_QTY));
      const clientId = AMBIENT_CLIENT_BASE + Math.floor(Math.random() * AMBIENT_CLIENT_POOL_SIZE);

      if (Math.random() < MARKET_ORDER_PROBABILITY) {
        engine.submitMarketOrder(side, qty, clientId);
        return;
      }

      const offset = Math.floor(Math.random() * SPREAD_TICKS);
      const price = side === SIDE_BUY ? midPriceRef.current - offset : midPriceRef.current + offset;
      const id = engine.submitLimitOrder(side, price, qty, clientId);
      liveIdsRef.current.push(id);
      if (liveIdsRef.current.length > MAX_TRACKED_IDS) liveIdsRef.current.shift();
    };

    const interval = setInterval(tick, BASE_INTERVAL_MS / speedMultiplier);
    return () => clearInterval(interval);
  }, [ready, enabled, engineRef, speedMultiplier]);
}
