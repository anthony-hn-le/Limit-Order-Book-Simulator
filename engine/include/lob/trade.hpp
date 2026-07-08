#pragma once

#include "lob/types.hpp"

namespace lob {

// Trades execute at the resting order's price, not the aggressor's.
struct Trade {
  TradeId id;
  OrderId aggressor_id;
  OrderId resting_id;
  Price price;
  Quantity quantity;
  Sequence sequence;
};

} // namespace lob
