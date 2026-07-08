// Cost of cancelling an existing order at a given book depth. The design
// claim is O(1) average: a hash lookup (handles_) plus two O(1)-amortized
// erase-by-iterator calls (std::list::erase and, on rare empty-level
// cleanup, std::map::erase(iterator) -- the single-element iterator
// overload is O(1) amortized per the standard, not O(log n)). This
// benchmark checks whether cost actually stays flat as depth grows, or
// whether it secretly scales.

#include <benchmark/benchmark.h>
#include <cstdint>
#include <vector>

#include "lob/order_book.hpp"

using namespace lob;

static void BM_Cancel(benchmark::State& state) {
  const std::int64_t depth = state.range(0);

  OrderBook book;
  std::vector<OrderId> ids;
  ids.reserve(static_cast<size_t>(depth));
  for (std::int64_t i = 0; i < depth; ++i) {
    ids.push_back(book.submit_limit_order(Side::Sell, 2'000'000 + i, 10, /*client=*/1));
  }

  size_t idx = 0;
  std::int64_t counter = depth;
  for (auto _ : state) {
    OrderId id = ids[idx];
    bool ok = book.cancel_order(id);
    benchmark::DoNotOptimize(ok);

    state.PauseTiming();
    // Replace the cancelled order so depth stays constant for the next iteration.
    ids[idx] = book.submit_limit_order(Side::Sell, 3'000'000 + counter++, 10, /*client=*/1);
    idx = (idx + 1) % ids.size();
    state.ResumeTiming();
  }
  state.SetComplexityN(depth);
}
BENCHMARK(BM_Cancel)->RangeMultiplier(10)->Range(10, 100000)->Complexity();
