#pragma once

#include <functional>
#include <map>
#include <unordered_map>

#include "lob/event_listener.hpp"
#include "lob/id_generator.hpp"
#include "lob/order.hpp"
#include "lob/price_level.hpp"
#include "lob/trade.hpp"
#include "lob/types.hpp"

namespace lob {

// A central limit order book with price-time priority matching.
//
// Bids are keyed std::greater<Price> (best = highest, at map::begin()),
// asks std::less<Price> (best = lowest, at map::begin()). std::map gives
// free ordered best-to-worst iteration (needed for both matching and
// snapshotting) and, critically, iterator/pointer stability across
// inserts/erases of *other* price levels -- required for the O(1) cancel
// design below, since a cancelled order's stored PriceLevel::Handle must
// stay valid even if unrelated price levels are added/removed meanwhile.
//
// Order ids are engine-generated (monotonic), not client-supplied.
// The engine is single-threaded; there is no internal locking.
class OrderBook {
public:
  explicit OrderBook(IEventListener* listener = nullptr) : listener_(listener) {}

  void set_listener(IEventListener* listener) { listener_ = listener; }

  // Crosses immediately against resting liquidity in price-time priority;
  // any remainder rests in the book. Returns the new order's id.
  OrderId submit_limit_order(Side side, Price price, Quantity quantity, ClientId client_id);

  // Sweeps resting liquidity until filled or the book is exhausted. Any
  // unfilled remainder is dropped (not rested) and reported via
  // on_order_rejected(UnfilledRemainder). Returns the new order's id.
  OrderId submit_market_order(Side side, Quantity quantity, ClientId client_id);

  // O(1) average: hash lookup + list::erase(iterator). Returns false if
  // the id is unknown (already filled or cancelled).
  bool cancel_order(OrderId id);

  bool has_bid() const { return !bids_.empty(); }
  bool has_ask() const { return !asks_.empty(); }
  // Precondition: has_bid() / has_ask(). Undefined on an empty side.
  Price best_bid() const { return bids_.begin()->first; }
  Price best_ask() const { return asks_.begin()->first; }

  size_t bid_level_count() const { return bids_.size(); }
  size_t ask_level_count() const { return asks_.size(); }
  size_t order_count() const { return handles_.size(); }

  // Visits price levels best-to-worst as (price, total_quantity, order_count).
  // Shared read path for the CLI ladder, benchmarks, and the WASM snapshot
  // marshaling layer, so none of them re-implement map traversal.
  template <typename Fn>
  void for_each_bid(Fn&& fn) const {
    for (const auto& [price, level] : bids_) {
      fn(price, level.total_quantity(), level.queue().size());
    }
  }

  template <typename Fn>
  void for_each_ask(Fn&& fn) const {
    for (const auto& [price, level] : asks_) {
      fn(price, level.total_quantity(), level.queue().size());
    }
  }

  // Visits every resting order (both sides) as a full Order snapshot.
  // O(n) in order count; intended for the differential fuzzer's
  // exact-equality checks, not the hot path.
  template <typename Fn>
  void for_each_order(Fn&& fn) const {
    for (const auto& [id, handle] : handles_) {
      fn(*handle.iterator);
    }
  }

private:
  struct OrderHandle {
    Side side;
    Price price;
    PriceLevel::Handle iterator;
  };

  using Bids = std::map<Price, PriceLevel, std::greater<Price>>;
  using Asks = std::map<Price, PriceLevel, std::less<Price>>;

  // price_limit == nullptr means "no price bound" (market order).
  void match_buy(Order& incoming, const Price* price_limit);
  void match_sell(Order& incoming, const Price* price_limit);

  void rest(const Order& order);

  Bids bids_;
  Asks asks_;
  std::unordered_map<OrderId, OrderHandle> handles_;
  OrderIdGenerator order_ids_;
  TradeIdGenerator trade_ids_;
  Sequence next_sequence_ = 1;
  IEventListener* listener_;
};

} // namespace lob
