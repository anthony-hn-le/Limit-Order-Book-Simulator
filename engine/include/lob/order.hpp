#pragma once

#include "lob/types.hpp"

namespace lob {

struct Order {
  OrderId id;
  Side side;
  OrderType type;
  Price price;       // ignored for Market orders
  Quantity quantity;  // original quantity, immutable after acceptance
  Quantity remaining; // decremented as the order fills
  Sequence sequence;  // logical arrival order, not wall-clock time
  ClientId client_id;
};

} // namespace lob
