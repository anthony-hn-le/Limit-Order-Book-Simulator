// Sustained mixed workload (70% new orders, 20% cancels, 10% market
// orders), driven by the same OrderFlowGenerator used by the CLI, at
// varying book depth. Bounds iterations explicitly (rather than letting
// Google Benchmark auto-tune) because most of each iteration's cost is a
// PauseTiming'd book rebuild -- left to auto-tuning, Benchmark would judge
// each iteration "fast" from the timed portion alone and run far more
// rebuild-heavy iterations than needed for a stable estimate.

#include <benchmark/benchmark.h>
#include <cstdint>
#include <random>
#include <vector>

#include "lob/order_book.hpp"
#include "lob/order_flow_generator.hpp"

using namespace lob;

namespace {
constexpr int kEventsPerIteration = 100;
}

static void BM_Throughput(benchmark::State& state) {
  const std::int64_t warm_depth = state.range(0);

  for (auto _ : state) {
    state.PauseTiming();
    OrderBook book;
    GeneratorConfig config; // arrival_rate is irrelevant here; we don't sleep on timestamps
    OrderFlowGenerator generator(config, /*seed=*/777);
    std::mt19937_64 client_rng(777);
    std::uniform_int_distribution<ClientId> client_dist(1, 50);
    std::vector<OrderId> live_ids;

    while (static_cast<std::int64_t>(live_ids.size()) < warm_depth) {
      GeneratedEvent event = generator.next();
      if (event.type == GeneratedEventType::NewOrder && event.order_type == OrderType::Limit) {
        OrderId id = book.submit_limit_order(event.side, event.price, event.quantity, client_dist(client_rng));
        live_ids.push_back(id);
      }
    }
    state.ResumeTiming();

    for (int i = 0; i < kEventsPerIteration; ++i) {
      GeneratedEvent event = generator.next();
      ClientId client = client_dist(client_rng);
      if (event.type == GeneratedEventType::Cancel) {
        if (!live_ids.empty()) {
          size_t idx = client_rng() % live_ids.size();
          if (book.cancel_order(live_ids[idx])) {
            live_ids[idx] = live_ids.back();
            live_ids.pop_back();
          }
        }
      } else if (event.order_type == OrderType::Market) {
        book.submit_market_order(event.side, event.quantity, client);
      } else {
        OrderId id = book.submit_limit_order(event.side, event.price, event.quantity, client);
        live_ids.push_back(id);
      }
    }
  }
  state.SetItemsProcessed(state.iterations() * kEventsPerIteration);
  state.SetComplexityN(warm_depth);
}
BENCHMARK(BM_Throughput)->RangeMultiplier(10)->Range(10, 10000)->Iterations(20)->Complexity();
