#pragma once

#include <cstdint>

namespace lob {

// Prices are integer ticks, never floating point. A std::map keyed on
// doubles risks equal-looking prices comparing unequal after rounding,
// and the differential fuzzer needs exact equality between the production
// book and the naive reference book. Ticks<->dollars conversion happens
// only at the CLI/WASM boundary.
using Price = std::int64_t;
using Quantity = std::uint64_t;
using OrderId = std::uint64_t;
using TradeId = std::uint64_t;
using ClientId = std::uint64_t;
using Sequence = std::uint64_t;

enum class Side { Buy, Sell };
enum class OrderType { Limit, Market };

} // namespace lob
