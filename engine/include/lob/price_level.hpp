#pragma once

#include <list>

#include "lob/order.hpp"
#include "lob/types.hpp"

namespace lob {

// FIFO queue of resting orders at a single price, for time priority.
// std::list (not std::deque) specifically because cancel needs O(1) erase
// from an arbitrary interior iterator without invalidating neighboring
// elements' iterators/references. std::deque only guarantees O(1) erase at
// the ends; interior erase is O(n) and invalidates surrounding iterators.
class PriceLevel {
public:
  using Queue = std::list<Order>;
  using Handle = Queue::iterator;

  Handle push_back(const Order& order) {
    total_quantity_ += order.remaining;
    queue_.push_back(order);
    auto it = queue_.end();
    --it;
    return it;
  }

  void erase(Handle handle) {
    total_quantity_ -= handle->remaining;
    queue_.erase(handle);
  }

  void reduce(Handle handle, Quantity filled) {
    handle->remaining -= filled;
    total_quantity_ -= filled;
  }

  bool empty() const { return queue_.empty(); }
  Quantity total_quantity() const { return total_quantity_; }
  Order& front() { return queue_.front(); }
  Queue& queue() { return queue_; }
  const Queue& queue() const { return queue_; }

private:
  Queue queue_;
  Quantity total_quantity_ = 0;
};

} // namespace lob
