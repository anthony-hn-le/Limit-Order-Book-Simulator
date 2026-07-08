#pragma once

#include "lob/types.hpp"

namespace lob {

// Monotonic counter. The engine is single-threaded (no std::atomic needed),
// consistent with WASM's default no-pthreads model, and order ids are
// engine-generated rather than client-supplied so there is no collision or
// validation path to write or fuzz.
template <typename IdType>
class IdGenerator {
public:
  IdType next() { return next_++; }

private:
  IdType next_ = 1;
};

using OrderIdGenerator = IdGenerator<OrderId>;
using TradeIdGenerator = IdGenerator<TradeId>;

} // namespace lob
