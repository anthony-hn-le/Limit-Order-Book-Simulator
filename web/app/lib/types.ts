// Mirrors the embind surface in wasm/bindings.cpp exactly -- keep in sync
// with that file if the bridge's shape changes.

export const SIDE_BUY = 0;
export const SIDE_SELL = 1;
export type SideValue = typeof SIDE_BUY | typeof SIDE_SELL;

export interface TradeEvent {
  id: number;
  aggressorId: number;
  restingId: number;
  price: number;
  quantity: number;
}

export interface BookSnapshot {
  bidCount: number;
  askCount: number;
  bidPrice: Float64Array;
  bidQty: Float64Array;
  askPrice: Float64Array;
  askQty: Float64Array;
}

export interface LobEngineHandle {
  submitLimitOrder(side: SideValue, price: number, quantity: number, clientId: number): number;
  submitMarketOrder(side: SideValue, quantity: number, clientId: number): number;
  cancelOrder(id: number): boolean;
  setOnTrade(cb: (trade: TradeEvent) => void): void;
  getBookSnapshot(depth: number): BookSnapshot;
}
