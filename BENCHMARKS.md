# Benchmarks

## Methodology

- Machine: Apple M4, 24 GB RAM, macOS (Darwin 25.5.0 arm64).
- Compiler: Apple clang 21.0.0, `-O3` via CMake `Release` build type.
- Harness: Google Benchmark v1.9.1, 7 repetitions per benchmark point (`--benchmark_repetitions=7`).
- Full command: `./build/bench/lob_bench --benchmark_repetitions=7 --benchmark_out=bench_results.json --benchmark_out_format=json`, post-processed with `bench/analyze_results.py`.

**On "p50/p99" below**: Google Benchmark's native aggregates (mean/median/stddev) are computed over *repetitions*, where each repetition is already an average over many auto-tuned iterations — Benchmark doesn't expose individual per-operation timestamps. So the p50/p99 figures here are percentiles across 7 repetition-level means, a measure of run-to-run variance, not a true single-operation tail-latency distribution. With n=7, "p99" is close to the max. Treat these as indicative, not a rigorous latency SLA.

These are laptop numbers, not a tuned production benchmark environment (no CPU pinning, no isolated core, no huge pages). They're offered as evidence the design choices below hold up empirically, not as an absolute performance claim.

## Results

### Insert (`bench_insert.cpp`)

Cost of resting a new non-crossing limit order into a book pre-populated to depth N (`std::map<Price, PriceLevel>` insert at a fresh key).

| Depth | p50 (ns) | p99 (ns) |
|---|---|---|
| 10 | 413.0 | 423.0 |
| 100 | 424.4 | 428.9 |
| 1,000 | 425.3 | 428.8 |
| 10,000 | 422.7 | 426.6 |
| 100,000 | 434.7 | 437.3 |

Google Benchmark's automatic complexity fit: **O(1)**, RMS 2% (very good fit). Insert is nominally O(log n) in the number of *distinct price levels* — but across 10 to 100,000 levels that's only a ~13x growth in `log₂(n)`, small enough that constant per-op overhead dominates in this range. Cost stays within ~5% from depth 10 to depth 100,000.

### Cancel (`bench_cancel.cpp`)

Cost of `cancel_order` at book depth N: hash lookup (`handles_`) + `std::list::erase(iterator)` + occasional `std::map::erase(iterator)` on empty-level cleanup — both are O(1) amortized per the standard's iterator-erase overloads, not O(log n).

| Depth | p50 (ns) | p99 (ns) |
|---|---|---|
| 10 | 415.9 | 421.9 |
| 100 | 437.0 | 448.1 |
| 1,000 | 439.7 | 473.0 |
| 10,000 | 452.5 | 456.9 |
| 100,000 | 471.5 | 486.9 |

Complexity fit: **O(1)**, RMS 4%. This validates the handle-based O(1)-average cancel design: cost grows only ~14% from depth 10 to depth 100,000, consistent with cache-locality effects on a bigger hash table/tree rather than any algorithmic scaling.

### Match (`bench_match.cpp`)

Cost of a market order sweeping N price levels, against a book that also holds a large (10,000-level), untouched background book on both sides.

| Levels swept | p50 (ns) | p99 (ns) |
|---|---|---|
| 1 | 414.1 | 415.9 |
| 4 | 538.9 | 543.0 |
| 16 | 1,016.9 | 1,044.0 |
| 64 | 3,120.5 | 3,177.5 |
| 256 | 11,206.3 | 11,290.3 |

Complexity fit: **O(N)** at ~42 ns/level, RMS 10%. Matching only ever touches `map::begin()` and erases via iterator — both O(1) amortized — so cost scales with *levels crossed*, not with total book depth (confirmed separately: the untouched 10,000-level background book doesn't move this number). A market order sweeping the entire book is exactly as expensive as its worst realistic case: O(levels swept), independent of how deep the rest of the book is.

### Throughput (`bench_throughput.cpp`)

Sustained mixed workload (70% new orders / 20% cancels / 10% market orders, driven by `OrderFlowGenerator`) at a warmed-up book depth N, 100 events timed per iteration, 20 iterations per depth (explicit, not auto-tuned — see source comment).

| Depth | Throughput (items/s) | p50 (ns/100-event batch) | p99 (ns/100-event batch) |
|---|---|---|---|
| 10 | 14.4 M | 6,800 | 7,887 |
| 100 | 15.0 M | 6,600 | 6,985 |
| 1,000 | 8.2 M | 12,250 | 12,814 |
| 10,000 | 2.7 M | 36,550 | 39,826 |

Complexity fit: O(log N), but a poor one (RMS 40%) — unlike the isolated insert/cancel/match benchmarks above, sustained throughput visibly degrades at depth 1,000+ (15M/s → 2.7M/s from depth 100 to 10,000). The per-operation benchmarks don't show this, which points to cache-locality effects from a much larger live working set (handles_ hash table, more price levels, bigger `std::list` queues) under a mixed, less-predictable access pattern — not a change in any single operation's algorithmic complexity. Worth investigating further (e.g. perf/cachegrind) rather than asserting a cause here.

## Known limitations

- Single-threaded only; no concurrent/sharded matching benchmarked (out of scope for v1 — see engine design notes).
- WASM builds (Emscripten, no SIMD/LTO by default, different allocator behavior) will be measurably slower than these native numbers. The browser demo should be read as a correctness/visualization artifact, not a repeat of this throughput claim — these native numbers are the real performance evidence.
- No comparison yet against the array-indexed-by-tick-offset price level alternative floated in the original design brainstorm; `std::map` was used for v1 and is what's measured here.
