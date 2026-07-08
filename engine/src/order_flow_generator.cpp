#include "lob/order_flow_generator.hpp"

namespace lob {

OrderFlowGenerator::OrderFlowGenerator(GeneratorConfig config, std::uint64_t seed)
    : config_(config), rng_(seed), mid_price_(config.mid_price) {}

GeneratedEvent OrderFlowGenerator::next() {
  std::exponential_distribution<double> inter_arrival(config_.arrival_rate);
  clock_sec_ += inter_arrival(rng_);

  std::uniform_real_distribution<double> unit(0.0, 1.0);
  std::uniform_int_distribution<int> direction(0, 1);
  Price step = (direction(rng_) == 0 ? -1 : 1) *
               (unit(rng_) < config_.walk_jump_probability ? config_.jump_size : config_.tick_step);
  mid_price_ += step;
  if (mid_price_ < config_.spread_ticks + 1) {
    mid_price_ = config_.spread_ticks + 1;
  }

  GeneratedEvent event{};
  event.timestamp_sec = clock_sec_;

  if (unit(rng_) < config_.cancel_probability) {
    event.type = GeneratedEventType::Cancel;
    return event;
  }

  event.type = GeneratedEventType::NewOrder;
  event.side = unit(rng_) < config_.buy_probability ? Side::Buy : Side::Sell;
  event.order_type =
      unit(rng_) < config_.market_order_probability ? OrderType::Market : OrderType::Limit;

  std::uniform_int_distribution<Quantity> qty_dist(config_.min_quantity, config_.max_quantity);
  event.quantity = qty_dist(rng_);

  std::uniform_int_distribution<Price> offset_dist(0, config_.spread_ticks);
  Price offset = offset_dist(rng_);
  event.price = (event.side == Side::Buy) ? mid_price_ - offset : mid_price_ + offset;

  return event;
}

} // namespace lob
