// Cost of inserting a new resting (non-crossing) limit order into a book
// pre-populated to a given depth. bids_/asks_ are std::map, so inserting
// at a fresh key is O(log n) in the number of distinct price levels --
// this benchmark measures whether that holds in practice.

#include <benchmark/benchmark.h>
#include <random>

#include "lob/order_book.hpp"

using namespace lob;

static void BM_Insert(benchmark::State& state) {
  const std::int64_t depth = state.range(0);

  OrderBook book;
  for (std::int64_t i = 0; i < depth; ++i) {
    book.submit_limit_order(Side::Sell, 2'000'000 + i, 10, /*client=*/1);
  }

  std::int64_t counter = 0;
  for (auto _ : state) {
    Price price = 3'000'000 + counter++; // always a fresh, non-crossing price level
    OrderId id = book.submit_limit_order(Side::Sell, price, 10, /*client=*/1);
    benchmark::DoNotOptimize(id);

    state.PauseTiming();
    book.cancel_order(id); // keep book depth ~constant across iterations
    state.ResumeTiming();
  }
  state.SetComplexityN(depth);
}
BENCHMARK(BM_Insert)->RangeMultiplier(10)->Range(10, 100000)->Complexity();
