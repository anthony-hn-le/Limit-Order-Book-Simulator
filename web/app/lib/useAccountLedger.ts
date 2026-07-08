"use client";

import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import { SIDE_BUY, SIDE_SELL } from "./types";
import type { LobEngineHandle, SideValue, TradeEvent } from "./types";

export type OrderStatus = "pending" | "filled" | "cancelled";
export type OrderKind = "limit" | "market";

export interface LedgerOrder {
  id: number;
  side: SideValue;
  kind: OrderKind;
  price: number | null; // null for market orders
  originalQty: number;
  filledQty: number;
  remaining: number;
  status: OrderStatus;
  timestamp: number;
}

export interface AccountState {
  cash: number;
  position: number; // signed inventory
  avgEntryPrice: number; // 0 when position === 0
  realizedPnl: number;
  orders: Record<number, LedgerOrder>;
}

// Weighted-average-cost fill application, pure and side-effect free so it's
// independently testable. `price` is the fill's actual execution price
// (never the order's nominal limit price -- a sweeping order can cross
// multiple levels, and cost accounting must reflect what actually happened).
export function applyFill(s: AccountState, side: SideValue, price: number, qty: number): AccountState {
  const signedQty = side === SIDE_BUY ? qty : -qty;
  const cash = s.cash - signedQty * price;

  const sameDirection = s.position === 0 || Math.sign(s.position) === Math.sign(signedQty);

  if (sameDirection) {
    // Opening or extending a position: recompute the weighted-average entry price.
    const newPosition = s.position + signedQty;
    const avgEntryPrice =
      s.position === 0 ? price : (s.avgEntryPrice * Math.abs(s.position) + price * qty) / Math.abs(newPosition);
    return { ...s, cash, position: newPosition, avgEntryPrice };
  }

  // Reducing, flattening, or flipping an existing position.
  const closingQty = Math.min(qty, Math.abs(s.position));
  const realizedDelta = (price - s.avgEntryPrice) * closingQty * Math.sign(s.position);
  const realizedPnl = s.realizedPnl + realizedDelta;
  const remainderQty = qty - closingQty;

  if (remainderQty === 0) {
    const newPosition = s.position + signedQty;
    const avgEntryPrice = newPosition === 0 ? 0 : s.avgEntryPrice; // partial close: remainder's basis is unchanged
    return { ...s, cash, position: newPosition, avgEntryPrice, realizedPnl };
  }

  // Flip: old position fully closed, remainder opens a new opposite-direction position at this fill's price.
  const newPosition = remainderQty * Math.sign(signedQty);
  return { ...s, cash, position: newPosition, avgEntryPrice: price, realizedPnl };
}

const TRADE_BUFFER_CAP = 500;

export function useAccountLedger(
  engineRef: RefObject<LobEngineHandle | null>,
  clientId: number,
  initialCash = 1_000_000,
) {
  const [state, setState] = useState<AccountState>({
    cash: initialCash,
    position: 0,
    avgEntryPrice: 0,
    realizedPnl: 0,
    orders: {},
  });

  // Plain mutable ref, not React state: submit wrappers need to read trade
  // events synchronously between "call the engine" and "the call returns",
  // since submitLimitOrder/submitMarketOrder fire setOnTrade *during* the
  // call, before the new order's id comes back (see useAccountLedger's
  // design note in the project plan). React state can't serve this -- it's
  // not a rendering concern, it's a low-level event log written to by the
  // C++-to-JS callback mid-call.
  const recentTradesRef = useRef<TradeEvent[]>([]);
  const prevQuoteRef = useRef<{ bidId: number; askId: number } | null>(null);

  const registerTradeForAttribution = useCallback((trade: TradeEvent) => {
    recentTradesRef.current.push(trade);
    if (recentTradesRef.current.length > TRADE_BUFFER_CAP) recentTradesRef.current.shift();

    setState((prev) => {
      const existing = prev.orders[trade.restingId];
      if (!existing) return prev; // not one of my resting orders
      const next = applyFill(prev, existing.side, trade.price, trade.quantity);
      const filledQty = existing.filledQty + trade.quantity;
      const remaining = existing.originalQty - filledQty;
      return {
        ...next,
        orders: {
          ...next.orders,
          [trade.restingId]: { ...existing, filledQty, remaining, status: remaining <= 0 ? "filled" : "pending" },
        },
      };
    });
  }, []);

  const submitMyLimitOrder = useCallback(
    (side: SideValue, price: number, quantity: number): number | null => {
      const engine = engineRef.current;
      if (!engine) return null;

      const startLen = recentTradesRef.current.length;
      const id = engine.submitLimitOrder(side, price, quantity, clientId);
      // Safe: the WASM call above is fully synchronous and JS is
      // single-threaded, so nothing else can have pushed to
      // recentTradesRef between startLen and here.
      const myFills = recentTradesRef.current.slice(startLen).filter((t) => t.aggressorId === id);
      const filledQty = myFills.reduce((sum, t) => sum + t.quantity, 0);

      setState((prev) => {
        let next = prev;
        for (const t of myFills) next = applyFill(next, side, t.price, t.quantity);
        const remaining = quantity - filledQty;
        const order: LedgerOrder = {
          id,
          side,
          kind: "limit",
          price,
          originalQty: quantity,
          filledQty,
          remaining,
          status: remaining <= 0 ? "filled" : "pending",
          timestamp: Date.now(),
        };
        return { ...next, orders: { ...next.orders, [id]: order } };
      });

      return id;
    },
    [engineRef, clientId],
  );

  const submitMyMarketOrder = useCallback(
    (side: SideValue, quantity: number): number | null => {
      const engine = engineRef.current;
      if (!engine) return null;

      const startLen = recentTradesRef.current.length;
      const id = engine.submitMarketOrder(side, quantity, clientId);
      const myFills = recentTradesRef.current.slice(startLen).filter((t) => t.aggressorId === id);
      const filledQty = myFills.reduce((sum, t) => sum + t.quantity, 0);

      setState((prev) => {
        let next = prev;
        for (const t of myFills) next = applyFill(next, side, t.price, t.quantity);
        // Market orders never rest (engine drops any unfilled remainder
        // rather than resting it), so status is always terminal, even at
        // filledQty === 0 (thin/empty book on the other side).
        const order: LedgerOrder = {
          id,
          side,
          kind: "market",
          price: null,
          originalQty: quantity,
          filledQty,
          remaining: quantity - filledQty,
          status: "filled",
          timestamp: Date.now(),
        };
        return { ...next, orders: { ...next.orders, [id]: order } };
      });

      return id;
    },
    [engineRef, clientId],
  );

  const cancelMyOrder = useCallback(
    (id: number): boolean => {
      const engine = engineRef.current;
      if (!engine) return false;
      const ok = engine.cancelOrder(id);

      setState((prev) => {
        const existing = prev.orders[id];
        if (!existing) return prev;
        if (ok) {
          return { ...prev, orders: { ...prev.orders, [id]: { ...existing, status: "cancelled" } } };
        }
        // engine.cancelOrder returned false: the order is no longer in the
        // engine's handle table. Either it's already fully filled (status
        // should already reflect that, this is a no-op), or it was
        // silently zeroed by self-trade prevention while the ledger still
        // believed it was pending -- the engine doesn't surface rejection
        // events to JS at all, so this is the only reconciliation point.
        // Zero financial impact either way: an unfilled remainder was
        // never counted as a fill.
        if (existing.status === "pending") {
          return { ...prev, orders: { ...prev.orders, [id]: { ...existing, status: "cancelled" } } };
        }
        return prev;
      });

      return ok;
    },
    [engineRef],
  );

  const submitMyQuote = useCallback(
    (bidPrice: number, bidQty: number, askPrice: number, askQty: number) => {
      if (prevQuoteRef.current) {
        const { bidId, askId } = prevQuoteRef.current;
        cancelMyOrder(bidId);
        cancelMyOrder(askId);
      }
      const bidId = submitMyLimitOrder(SIDE_BUY, bidPrice, bidQty);
      const askId = submitMyLimitOrder(SIDE_SELL, askPrice, askQty);
      if (bidId == null || askId == null) {
        prevQuoteRef.current = null;
        return null;
      }
      prevQuoteRef.current = { bidId, askId };
      return { bidId, askId };
    },
    [submitMyLimitOrder, cancelMyOrder],
  );

  const unrealizedPnl = useCallback(
    (midPrice: number | null): number => {
      if (midPrice === null || state.position === 0) return 0;
      return (midPrice - state.avgEntryPrice) * state.position;
    },
    [state.position, state.avgEntryPrice],
  );

  const orders = useMemo(
    () => Object.values(state.orders).sort((a, b) => b.timestamp - a.timestamp),
    [state.orders],
  );

  return {
    cash: state.cash,
    position: state.position,
    avgEntryPrice: state.avgEntryPrice,
    realizedPnl: state.realizedPnl,
    orders,
    unrealizedPnl,
    submitMyLimitOrder,
    submitMyMarketOrder,
    submitMyQuote,
    cancelMyOrder,
    registerTradeForAttribution,
  };
}
