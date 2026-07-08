#pragma once

#include <cstdint>
#include <random>

#include "lob/types.hpp"

namespace lob {

struct GeneratorConfig {
  double arrival_rate = 100.0;          // orders/sec, mean of exponential inter-arrival
  Price mid_price = 10000;              // starting mid price, in ticks
  Price tick_step = 1;                  // usual random-walk step size
  double walk_jump_probability = 0.02;  // probability of a larger volatility burst
  Price jump_size = 20;
  double market_order_probability = 0.1;
  double cancel_probability = 0.15;     // probability an event is "cancel some resting order"
  double buy_probability = 0.5;
  Quantity min_quantity = 1;
  Quantity max_quantity = 100;
  Price spread_ticks = 5;               // orders placed within [mid, mid +/- spread_ticks]
};

enum class GeneratedEventType { NewOrder, Cancel };

// Cancel events don't name a target order: the generator has no view of
// the book's live order ids by design (engine/ stays free of any
// consumer-specific state). The caller -- which tracks its own live ids --
// picks which resting order to cancel.
struct GeneratedEvent {
  GeneratedEventType type;
  double timestamp_sec;
  Side side;             // meaningful only for NewOrder
  OrderType order_type;   // meaningful only for NewOrder
  Price price;            // meaningful only for NewOrder
  Quantity quantity;      // meaningful only for NewOrder
};

// Poisson arrivals (exponential inter-arrival times) driving a
// random-walk mid-price. Shared by cli/ (replay/demo) and bench/
// (throughput driver) so there is exactly one generator implementation.
class OrderFlowGenerator {
public:
  OrderFlowGenerator(GeneratorConfig config, std::uint64_t seed);

  // Produces the next event and advances the internal clock/mid-price.
  GeneratedEvent next();

private:
  GeneratorConfig config_;
  std::mt19937_64 rng_;
  double clock_sec_ = 0.0;
  Price mid_price_;
};

} // namespace lob
