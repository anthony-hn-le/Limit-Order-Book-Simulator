#pragma once

#include <vector>

#include "lob/event_listener.hpp"

namespace lob::testing {

// Records every event verbatim so tests can assert exact sequences.
class RecordingListener : public IEventListener {
public:
  std::vector<Order> accepted;
  std::vector<Order> cancelled;
  std::vector<std::pair<Order, RejectReason>> rejected;
  std::vector<Trade> trades;

  void on_order_accepted(const Order& order) override { accepted.push_back(order); }
  void on_order_cancelled(const Order& order) override { cancelled.push_back(order); }
  void on_order_rejected(const Order& order, RejectReason reason) override {
    rejected.emplace_back(order, reason);
  }
  void on_trade(const Trade& trade) override { trades.push_back(trade); }
};

} // namespace lob::testing
