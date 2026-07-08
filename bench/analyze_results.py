#!/usr/bin/env python3
"""Post-processes Google Benchmark JSON output into p50/p99 per benchmark.

Google Benchmark's built-in aggregates are mean/median/stddev/cv over
*repetitions* (each repetition already an average over many iterations),
not a percentile over individual operation latencies -- Benchmark doesn't
expose per-op timestamps. So the "p50"/"p99" here are percentiles of
repetition-level means, a coarser measure of run-to-run variance, not a
true single-operation tail latency distribution. Documented explicitly so
BENCHMARKS.md doesn't overclaim what a handful of repetitions can support.

Usage: analyze_results.py bench_results.json
"""

import json
import sys
from collections import defaultdict


def percentile(sorted_values, pct):
    if not sorted_values:
        return float("nan")
    k = (len(sorted_values) - 1) * (pct / 100.0)
    lo, hi = int(k), min(int(k) + 1, len(sorted_values) - 1)
    if lo == hi:
        return sorted_values[lo]
    frac = k - lo
    return sorted_values[lo] * (1 - frac) + sorted_values[hi] * frac


def main():
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <bench_results.json>", file=sys.stderr)
        return 1

    with open(sys.argv[1]) as f:
        data = json.load(f)

    by_name = defaultdict(list)
    for entry in data["benchmarks"]:
        if entry.get("run_type") == "iteration":
            by_name[entry["run_name"]].append(entry["cpu_time"])

    print(f"{'benchmark':<32} {'n':>3} {'p50 (ns)':>12} {'p99 (ns)':>12} {'min (ns)':>12} {'max (ns)':>12}")
    for name, samples in by_name.items():
        samples.sort()
        p50 = percentile(samples, 50)
        p99 = percentile(samples, 99)
        print(f"{name:<32} {len(samples):>3} {p50:>12.1f} {p99:>12.1f} {samples[0]:>12.1f} {samples[-1]:>12.1f}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
