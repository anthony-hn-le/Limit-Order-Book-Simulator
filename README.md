# Limit Order Book Simulator

A from-scratch C++ central limit order book (CLOB) with price-time priority matching, a differential fuzzer checked against a naive O(n) reference implementation, a Google Benchmark suite backing concrete performance numbers (see [`BENCHMARKS.md`](BENCHMARKS.md)), and a terminal replay tool. A browser demo (matching engine compiled to WebAssembly, live order book ladder / depth chart / trade tape) is in progress.

## Status

| Component | Status |
|---|---|
| Matching engine (limit + market orders, cancel, self-trade prevention) | Done |
| Differential fuzzer vs. naive reference book | Done |
| `lob-cli` terminal replay + benchmark-corpus generator | Done |
| Benchmark suite (insert/cancel/match/throughput) | Done |
| WASM bindings | In progress |
| Web frontend (order book ladder, depth chart, trade tape) | Not started |
| Deploy | Not started |

## Design

- **Prices are integer ticks** (`int64_t`), never floats — avoids float-equality bugs in `std::map` keys and in the fuzzer's exact-equality checks.
- **Price levels**: `std::map<Price, PriceLevel>` (bids descending, asks ascending) of `std::list<Order>` FIFO queues, giving ordered best-to-worst iteration plus iterator/pointer stability across unrelated inserts/erases.
- **O(1)-average cancel**: an `unordered_map<OrderId, OrderHandle>` storing a `std::list` iterator per resting order — see [`BENCHMARKS.md`](BENCHMARKS.md) for the measured confirmation that cancel really is flat with book depth, not the O(log n) a naive read of "sorted map" might suggest.
- **Self-trade prevention**: cancel-newest — a self-crossing incoming order is rejected outright rather than matched against its own resting order or rested to cross again later.
- **Market orders never rest**: an unfilled remainder after sweeping the book is dropped (IOC-style), not left waiting for future liquidity.

See `engine/include/lob/order_book.hpp` for the full design rationale in comments.

## Build

Requires CMake 3.20+ and a C++20 compiler.

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure   # unit tests + fixed-seed differential fuzz
```

Configure flags: `-DLOB_BUILD_TESTS=OFF`, `-DLOB_BUILD_BENCH=OFF`, `-DLOB_BUILD_CLI=OFF` to skip a component.

## Try it

```sh
./build/cli/lob-cli replay --seed 42 --arrival-rate 500 --count 2000
```

Drives a synthetic Poisson-arrival, random-walk order flow against a live book and redraws a text-mode ladder + trade tape as it goes.

## Benchmark

```sh
./build/bench/lob_bench --benchmark_repetitions=7 --benchmark_out=bench_results.json --benchmark_out_format=json
python3 bench/analyze_results.py bench_results.json
```

See [`BENCHMARKS.md`](BENCHMARKS.md) for measured results and methodology.

## Repo layout

```
engine/   core matching engine (library)
tests/    unit tests (GoogleTest) + differential fuzzer vs. a naive reference book
bench/    Google Benchmark suite + results post-processing
cli/      lob-cli: terminal replay demo and benchmark-corpus generator
wasm/     Emscripten bindings (in progress)
web/      Next.js browser demo (not started)
```
