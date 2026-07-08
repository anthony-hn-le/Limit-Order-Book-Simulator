#include "naive_reference_book.hpp"

#include <algorithm>
#include <limits>

namespace lob::testing {

int NaiveReferenceBook::find_best_index(Side aggressor_side, const Price* price_limit) const {
  Side opposite = (aggressor_side == Side::Buy) ? Side::Sell : Side::Buy;
  int best = -1;
  for (int i = 0; i < static_cast<int>(orders_.size()); ++i) {
    const Order& o = orders_[static_cast<size_t>(i)];
    if (o.side != opposite) continue;

    bool crosses = true;
    if (price_limit != nullptr) {
      crosses = (aggressor_side == Side::Buy) ? (*price_limit >= o.price) : (*price_limit <= o.price);
    }
    if (!crosses) continue;

    if (best == -1) {
      best = i;
      continue;
    }
    const Order& b = orders_[static_cast<size_t>(best)];
    bool better = (aggressor_side == Side::Buy)
                      ? (o.price < b.price || (o.price == b.price && o.sequence < b.sequence))
                      : (o.price > b.price || (o.price == b.price && o.sequence < b.sequence));
    if (better) best = i;
  }
  return best;
}

void NaiveReferenceBook::match(Order& incoming, const Price* price_limit) {
  while (incoming.remaining > 0) {
    int idx = find_best_index(incoming.side, price_limit);
    if (idx < 0) break;

    Order& resting = orders_[static_cast<size_t>(idx)];

    if (resting.client_id == incoming.client_id) {
      if (listener_) listener_->on_order_rejected(incoming, RejectReason::SelfTradePrevented);
      incoming.remaining = 0;
      return;
    }

    Quantity fill_qty = std::min(incoming.remaining, resting.remaining);
    Trade trade{trade_ids_.next(), incoming.id, resting.id, resting.price, fill_qty, next_sequence_++};

    incoming.remaining -= fill_qty;
    resting.remaining -= fill_qty;

    if (listener_) listener_->on_trade(trade);

    if (resting.remaining == 0) {
      orders_.erase(orders_.begin() + idx);
    }
  }
}

OrderId NaiveReferenceBook::submit_limit_order(Side side, Price price, Quantity quantity, ClientId client_id) {
  Order incoming{order_ids_.next(), side, OrderType::Limit, price, quantity, quantity,
                  next_sequence_++, client_id};
  if (listener_) listener_->on_order_accepted(incoming);
  match(incoming, &price);
  if (incoming.remaining > 0) orders_.push_back(incoming);
  return incoming.id;
}

OrderId NaiveReferenceBook::submit_market_order(Side side, Quantity quantity, ClientId client_id) {
  Order incoming{order_ids_.next(), side, OrderType::Market, 0, quantity, quantity,
                  next_sequence_++, client_id};
  if (listener_) listener_->on_order_accepted(incoming);
  match(incoming, nullptr);
  if (incoming.remaining > 0) {
    if (listener_) listener_->on_order_rejected(incoming, RejectReason::UnfilledRemainder);
  }
  return incoming.id;
}

bool NaiveReferenceBook::cancel_order(OrderId id) {
  for (size_t i = 0; i < orders_.size(); ++i) {
    if (orders_[i].id == id) {
      Order cancelled = orders_[i];
      orders_.erase(orders_.begin() + static_cast<long>(i));
      if (listener_) listener_->on_order_cancelled(cancelled);
      return true;
    }
  }
  return false;
}

bool NaiveReferenceBook::has_bid() const {
  for (const auto& o : orders_) {
    if (o.side == Side::Buy) return true;
  }
  return false;
}

bool NaiveReferenceBook::has_ask() const {
  for (const auto& o : orders_) {
    if (o.side == Side::Sell) return true;
  }
  return false;
}

Price NaiveReferenceBook::best_bid() const {
  Price best = std::numeric_limits<Price>::min();
  for (const auto& o : orders_) {
    if (o.side == Side::Buy && o.price > best) best = o.price;
  }
  return best;
}

Price NaiveReferenceBook::best_ask() const {
  Price best = std::numeric_limits<Price>::max();
  for (const auto& o : orders_) {
    if (o.side == Side::Sell && o.price < best) best = o.price;
  }
  return best;
}

} // namespace lob::testing
