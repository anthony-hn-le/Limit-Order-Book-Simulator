#pragma once

#include "lob/order.hpp"
#include "lob/trade.hpp"

namespace lob {

enum class RejectReason { UnfilledRemainder, SelfTradePrevented };

// Abstract interface, not std::function: std::function risks a heap
// allocation for captures and adds type-erasure dispatch overhead inside
// the matching hot loop. A virtual call is cheaper and lets the benchmark
// suite attach a genuinely empty no-op listener to isolate matching cost
// from listener cost. Each consumer (CLI, benchmark harness, WASM bridge)
// implements its own subclass; engine/ has no knowledge of any of them.
class IEventListener {
public:
  virtual ~IEventListener() = default;

  virtual void on_order_accepted(const Order& /*order*/) {}
  virtual void on_order_cancelled(const Order& /*order*/) {}
  virtual void on_order_rejected(const Order& /*order*/, RejectReason /*reason*/) {}
  virtual void on_trade(const Trade& /*trade*/) {}
};

} // namespace lob
