#pragma once

#include <vector>

#include "lob/event_listener.hpp"
#include "lob/id_generator.hpp"
#include "lob/order.hpp"
#include "lob/types.hpp"

namespace lob::testing {

// Deliberately simple O(n) oracle for the differential fuzzer: a flat
// vector per side (mixed together, filtered by Side on scan), linear scan
// for best price + earliest arrival. Correct by inspection, not by
// performance -- this is the thing OrderBook is checked against, not a
// second production implementation.
//
// Uses the same monotonic id-generation scheme as OrderBook so that, when
// driven by an identical operation sequence, both books assign identical
// OrderIds/TradeIds -- which makes differential comparison a direct
// structural equality check rather than requiring an id-mapping step.
class NaiveReferenceBook {
public:
  explicit NaiveReferenceBook(IEventListener* listener = nullptr) : listener_(listener) {}

  OrderId submit_limit_order(Side side, Price price, Quantity quantity, ClientId client_id);
  OrderId submit_market_order(Side side, Quantity quantity, ClientId client_id);
  bool cancel_order(OrderId id);

  bool has_bid() const;
  bool has_ask() const;
  Price best_bid() const;
  Price best_ask() const;

  // Snapshot of all resting orders (both sides), for differential comparison.
  std::vector<Order> resting_orders() const { return orders_; }

private:
  void match(Order& incoming, const Price* price_limit);
  int find_best_index(Side aggressor_side, const Price* price_limit) const;

  std::vector<Order> orders_; // resting orders, both sides mixed
  OrderIdGenerator order_ids_;
  TradeIdGenerator trade_ids_;
  Sequence next_sequence_ = 1;
  IEventListener* listener_;
};

} // namespace lob::testing
