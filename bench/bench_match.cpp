// Cost of a market order sweeping N price levels. Matching only ever
// touches std::map::begin() and erases via iterator (O(1) amortized), so
// the design claim is that match cost scales with *levels crossed*, not
// with total book depth -- this benchmark parametrizes by sweep size, and
// separately keeps a large, untouched "background" book on both sides to
// confirm depth elsewhere doesn't leak into the cost.

#include <benchmark/benchmark.h>
#include <cstdint>

#include "lob/order_book.hpp"

using namespace lob;

static void BM_Match(benchmark::State& state) {
  const std::int64_t sweep_levels = state.range(0);
  const Quantity qty_per_level = 10;
  const std::int64_t background_depth = 10000;

  OrderBook book;
  // Background liquidity, deliberately priced so the timed sweep never
  // reaches it -- present only to give the book realistic ambient depth.
  for (std::int64_t i = 0; i < background_depth; ++i) {
    book.submit_limit_order(Side::Sell, 5'000'000 + i, qty_per_level, /*client=*/1);
    book.submit_limit_order(Side::Buy, 1'000'000 - i, qty_per_level, /*client=*/1);
  }

  std::int64_t counter = 0;
  for (auto _ : state) {
    state.PauseTiming();
    for (std::int64_t i = 0; i < sweep_levels; ++i) {
      book.submit_limit_order(Side::Sell, 2'000'000 + counter++, qty_per_level, /*client=*/1);
    }
    state.ResumeTiming();

    Quantity sweep_qty = static_cast<Quantity>(sweep_levels) * qty_per_level;
    benchmark::DoNotOptimize(book.submit_market_order(Side::Buy, sweep_qty, /*client=*/2));
  }
  state.SetComplexityN(sweep_levels);
}
BENCHMARK(BM_Match)->RangeMultiplier(4)->Range(1, 256)->Complexity();
