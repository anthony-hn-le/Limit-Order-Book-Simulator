#include "lob/order_book.hpp"

#include <algorithm>

namespace lob {

OrderId OrderBook::submit_limit_order(Side side, Price price, Quantity quantity, ClientId client_id) {
  Order incoming{order_ids_.next(), side, OrderType::Limit, price, quantity, quantity,
                  next_sequence_++, client_id};
  if (listener_) listener_->on_order_accepted(incoming);

  if (side == Side::Buy) {
    match_buy(incoming, &price);
  } else {
    match_sell(incoming, &price);
  }

  if (incoming.remaining > 0) {
    rest(incoming);
  }
  return incoming.id;
}

OrderId OrderBook::submit_market_order(Side side, Quantity quantity, ClientId client_id) {
  Order incoming{order_ids_.next(), side, OrderType::Market, 0, quantity, quantity,
                  next_sequence_++, client_id};
  if (listener_) listener_->on_order_accepted(incoming);

  if (side == Side::Buy) {
    match_buy(incoming, nullptr);
  } else {
    match_sell(incoming, nullptr);
  }

  // Market orders never rest: an unfilled remainder means the book was
  // exhausted, not that the order should wait for future liquidity.
  if (incoming.remaining > 0) {
    if (listener_) listener_->on_order_rejected(incoming, RejectReason::UnfilledRemainder);
  }
  return incoming.id;
}

bool OrderBook::cancel_order(OrderId id) {
  auto it = handles_.find(id);
  if (it == handles_.end()) return false;

  OrderHandle handle = it->second; // copy: erasing from handles_ below invalidates `it`
  Order cancelled = *handle.iterator;
  handles_.erase(it);

  if (handle.side == Side::Buy) {
    auto level_it = bids_.find(handle.price);
    level_it->second.erase(handle.iterator);
    if (level_it->second.empty()) bids_.erase(level_it);
  } else {
    auto level_it = asks_.find(handle.price);
    level_it->second.erase(handle.iterator);
    if (level_it->second.empty()) asks_.erase(level_it);
  }

  if (listener_) listener_->on_order_cancelled(cancelled);
  return true;
}

void OrderBook::rest(const Order& order) {
  if (order.side == Side::Buy) {
    PriceLevel& level = bids_[order.price];
    auto it = level.push_back(order);
    handles_[order.id] = OrderHandle{Side::Buy, order.price, it};
  } else {
    PriceLevel& level = asks_[order.price];
    auto it = level.push_back(order);
    handles_[order.id] = OrderHandle{Side::Sell, order.price, it};
  }
}

void OrderBook::match_buy(Order& incoming, const Price* price_limit) {
  while (incoming.remaining > 0 && !asks_.empty()) {
    auto level_it = asks_.begin();
    Price level_price = level_it->first;
    if (price_limit != nullptr && *price_limit < level_price) break;

    PriceLevel& level = level_it->second;
    auto resting_it = level.queue().begin();

    // Self-trade prevention: cancel-newest. The incoming order is always
    // the newer of the two, so on a self-cross we reject its remaining
    // quantity and stop rather than matching it against its own resting
    // order (or skipping ahead and breaking time priority for others).
    if (resting_it->client_id == incoming.client_id) {
      if (listener_) listener_->on_order_rejected(incoming, RejectReason::SelfTradePrevented);
      incoming.remaining = 0;
      return;
    }

    Quantity fill_qty = std::min(incoming.remaining, resting_it->remaining);
    Trade trade{trade_ids_.next(), incoming.id, resting_it->id, level_price, fill_qty, next_sequence_++};

    incoming.remaining -= fill_qty;
    level.reduce(resting_it, fill_qty);

    if (listener_) listener_->on_trade(trade);

    if (resting_it->remaining == 0) {
      OrderId resting_id = resting_it->id;
      level.erase(resting_it);
      handles_.erase(resting_id);
      if (level.empty()) {
        asks_.erase(level_it);
      }
    }
  }
}

void OrderBook::match_sell(Order& incoming, const Price* price_limit) {
  while (incoming.remaining > 0 && !bids_.empty()) {
    auto level_it = bids_.begin();
    Price level_price = level_it->first;
    if (price_limit != nullptr && *price_limit > level_price) break;

    PriceLevel& level = level_it->second;
    auto resting_it = level.queue().begin();

    if (resting_it->client_id == incoming.client_id) {
      if (listener_) listener_->on_order_rejected(incoming, RejectReason::SelfTradePrevented);
      incoming.remaining = 0;
      return;
    }

    Quantity fill_qty = std::min(incoming.remaining, resting_it->remaining);
    Trade trade{trade_ids_.next(), incoming.id, resting_it->id, level_price, fill_qty, next_sequence_++};

    incoming.remaining -= fill_qty;
    level.reduce(resting_it, fill_qty);

    if (listener_) listener_->on_trade(trade);

    if (resting_it->remaining == 0) {
      OrderId resting_id = resting_it->id;
      level.erase(resting_it);
      handles_.erase(resting_id);
      if (level.empty()) {
        bids_.erase(level_it);
      }
    }
  }
}

} // namespace lob
