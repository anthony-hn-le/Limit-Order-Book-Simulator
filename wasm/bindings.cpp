// Emscripten embind bridge exposing lob::OrderBook to JavaScript.
//
// Marshaling design (avoids per-event allocation at the JS/WASM boundary):
//  - getBookSnapshot is pull-based: the frontend polls it on a throttled
//    interval rather than the engine pushing a snapshot on every mutation
//    -- order books don't need 60fps updates, and every call crosses the
//    boundary. Snapshot data is written into pre-allocated flat arrays in
//    WASM linear memory and exposed to JS as typed_memory_view (zero-copy
//    from WASM's side), avoiding one JS object allocation per price level
//    per poll.
//  - The trade feed stays push-per-event via setOnTrade: trades are
//    comparatively low-frequency and the trade tape wants every one
//    individually, so a per-trade val::object() is fine here.
//  - Order ids cross as JS `number` (safe under 2^53 for realistic session
//    order counts), not BigInt/string.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <algorithm>
#include <cstdint>

#include "lob/order_book.hpp"

using namespace lob;
using emscripten::val;

namespace {

constexpr int kMaxSnapshotLevels = 64;

// Pre-allocated so getBookSnapshot never allocates; overwritten in place
// on every call and exposed to JS via typed_memory_view.
struct SnapshotBuffers {
  double bid_price[kMaxSnapshotLevels];
  double bid_qty[kMaxSnapshotLevels];
  double ask_price[kMaxSnapshotLevels];
  double ask_qty[kMaxSnapshotLevels];
  int bid_count = 0;
  int ask_count = 0;
};

class JsListener : public IEventListener {
public:
  val on_trade_cb = val::null();

  void on_trade(const Trade& t) override {
    if (on_trade_cb.isNull()) return;
    val obj = val::object();
    obj.set("id", static_cast<double>(t.id));
    obj.set("aggressorId", static_cast<double>(t.aggressor_id));
    obj.set("restingId", static_cast<double>(t.resting_id));
    obj.set("price", static_cast<double>(t.price));
    obj.set("quantity", static_cast<double>(t.quantity));
    on_trade_cb(obj);
  }
};

} // namespace

// side: 0 = Buy, 1 = Sell (kept as a plain int across the boundary rather
// than an embind enum, to keep the JS-side call sites trivial).
class LobEngine {
public:
  LobEngine() : book_(&listener_) {}

  double submitLimitOrder(int side, double price, double quantity, double client_id) {
    OrderId id = book_.submit_limit_order(side == 0 ? Side::Buy : Side::Sell, static_cast<Price>(price),
                                           static_cast<Quantity>(quantity),
                                           static_cast<ClientId>(client_id));
    return static_cast<double>(id);
  }

  double submitMarketOrder(int side, double quantity, double client_id) {
    OrderId id = book_.submit_market_order(side == 0 ? Side::Buy : Side::Sell,
                                            static_cast<Quantity>(quantity),
                                            static_cast<ClientId>(client_id));
    return static_cast<double>(id);
  }

  bool cancelOrder(double id) { return book_.cancel_order(static_cast<OrderId>(id)); }

  void setOnTrade(val callback) { listener_.on_trade_cb = callback; }

  val getBookSnapshot(int depth) {
    depth = std::min(depth, kMaxSnapshotLevels);
    buffers_.bid_count = 0;
    buffers_.ask_count = 0;

    book_.for_each_bid([&](Price p, Quantity q, size_t) {
      if (buffers_.bid_count < depth) {
        buffers_.bid_price[buffers_.bid_count] = static_cast<double>(p);
        buffers_.bid_qty[buffers_.bid_count] = static_cast<double>(q);
        buffers_.bid_count++;
      }
    });
    book_.for_each_ask([&](Price p, Quantity q, size_t) {
      if (buffers_.ask_count < depth) {
        buffers_.ask_price[buffers_.ask_count] = static_cast<double>(p);
        buffers_.ask_qty[buffers_.ask_count] = static_cast<double>(q);
        buffers_.ask_count++;
      }
    });

    val result = val::object();
    result.set("bidCount", buffers_.bid_count);
    result.set("askCount", buffers_.ask_count);
    result.set("bidPrice", val(emscripten::typed_memory_view(kMaxSnapshotLevels, buffers_.bid_price)));
    result.set("bidQty", val(emscripten::typed_memory_view(kMaxSnapshotLevels, buffers_.bid_qty)));
    result.set("askPrice", val(emscripten::typed_memory_view(kMaxSnapshotLevels, buffers_.ask_price)));
    result.set("askQty", val(emscripten::typed_memory_view(kMaxSnapshotLevels, buffers_.ask_qty)));
    return result;
  }

private:
  JsListener listener_;
  OrderBook book_;
  SnapshotBuffers buffers_;
};

EMSCRIPTEN_BINDINGS(lob_module) {
  emscripten::class_<LobEngine>("LobEngine")
      .constructor<>()
      .function("submitLimitOrder", &LobEngine::submitLimitOrder)
      .function("submitMarketOrder", &LobEngine::submitMarketOrder)
      .function("cancelOrder", &LobEngine::cancelOrder)
      .function("setOnTrade", &LobEngine::setOnTrade)
      .function("getBookSnapshot", &LobEngine::getBookSnapshot);
}
