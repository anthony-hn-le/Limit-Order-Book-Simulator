// Differential fuzzer: drives lob::OrderBook and NaiveReferenceBook with an
// identical random operation sequence and asserts, after every single op,
// that they agree exactly. On mismatch it prints the seed and iteration
// index so the failure is reproducible by rerunning with the same --seed
// and a smaller --iterations bound (manual bisection; not automated here).
//
// Usage: lob_differential_fuzzer --seed 42 --iterations 100000

#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <random>
#include <vector>

#include "lob/order_book.hpp"
#include "naive_reference_book.hpp"

using namespace lob;

namespace {

struct Args {
  std::uint64_t seed = 42;
  std::uint64_t iterations = 100000;
};

Args parse_args(int argc, char** argv) {
  Args args;
  for (int i = 1; i < argc; ++i) {
    if (std::strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
      args.seed = std::strtoull(argv[++i], nullptr, 10);
    } else if (std::strcmp(argv[i], "--iterations") == 0 && i + 1 < argc) {
      args.iterations = std::strtoull(argv[++i], nullptr, 10);
    }
  }
  return args;
}

class CollectingListener : public IEventListener {
public:
  std::vector<Trade> trades;
  void on_trade(const Trade& t) override { trades.push_back(t); }
};

std::vector<Order> snapshot(const OrderBook& book) {
  std::vector<Order> result;
  book.for_each_order([&](const Order& o) { result.push_back(o); });
  return result;
}

bool orders_match(std::vector<Order> a, std::vector<Order> b) {
  if (a.size() != b.size()) return false;
  auto by_id = [](const Order& x, const Order& y) { return x.id < y.id; };
  std::sort(a.begin(), a.end(), by_id);
  std::sort(b.begin(), b.end(), by_id);
  for (size_t i = 0; i < a.size(); ++i) {
    if (a[i].id != b[i].id || a[i].side != b[i].side || a[i].price != b[i].price ||
        a[i].remaining != b[i].remaining) {
      return false;
    }
  }
  return true;
}

bool run(std::uint64_t seed, std::uint64_t iterations) {
  std::mt19937_64 rng(seed);
  std::uniform_int_distribution<int> op_dist(0, 9);   // 0-1 cancel, 2 market, 3-9 limit
  std::uniform_int_distribution<int> side_dist(0, 1);
  std::uniform_int_distribution<Price> price_dist(9900, 10100);
  std::uniform_int_distribution<Quantity> qty_dist(1, 50);
  std::uniform_int_distribution<ClientId> client_dist(1, 20);

  CollectingListener prod_listener, ref_listener;
  OrderBook prod(&prod_listener);
  lob::testing::NaiveReferenceBook ref(&ref_listener);
  std::vector<OrderId> live_ids;

  auto fail = [&](const char* what) {
    std::fprintf(stderr, "MISMATCH: %s (seed=%llu iteration=%llu)\n", what,
                 static_cast<unsigned long long>(seed), static_cast<unsigned long long>(iterations));
  };

  for (std::uint64_t i = 0; i < iterations; ++i) {
    int op = op_dist(rng);
    Side side = side_dist(rng) == 0 ? Side::Buy : Side::Sell;
    ClientId client = client_dist(rng);

    if (op <= 1 && !live_ids.empty()) {
      std::uniform_int_distribution<size_t> idx_dist(0, live_ids.size() - 1);
      size_t idx = idx_dist(rng);
      OrderId id = live_ids[idx];
      bool prod_ok = prod.cancel_order(id);
      bool ref_ok = ref.cancel_order(id);
      if (prod_ok != ref_ok) {
        fail("cancel result diverged");
        return false;
      }
      if (prod_ok) live_ids.erase(live_ids.begin() + static_cast<long>(idx));
    } else if (op == 2) {
      Quantity qty = qty_dist(rng);
      prod.submit_market_order(side, qty, client);
      ref.submit_market_order(side, qty, client);
    } else {
      Price price = price_dist(rng);
      Quantity qty = qty_dist(rng);
      OrderId prod_id = prod.submit_limit_order(side, price, qty, client);
      OrderId ref_id = ref.submit_limit_order(side, price, qty, client);
      if (prod_id != ref_id) {
        fail("order id assignment diverged");
        return false;
      }
      live_ids.push_back(prod_id);
    }

    if (prod_listener.trades.size() != ref_listener.trades.size()) {
      fail("trade count diverged");
      return false;
    }
    for (size_t t = 0; t < prod_listener.trades.size(); ++t) {
      const Trade& pt = prod_listener.trades[t];
      const Trade& rt = ref_listener.trades[t];
      if (pt.id != rt.id || pt.aggressor_id != rt.aggressor_id || pt.resting_id != rt.resting_id ||
          pt.price != rt.price || pt.quantity != rt.quantity) {
        fail("trade contents diverged");
        return false;
      }
    }

    if (prod.has_bid() && prod.has_ask() && prod.best_bid() >= prod.best_ask()) {
      fail("book left crossed");
      return false;
    }
    if (prod.has_bid() != ref.has_bid() || (prod.has_bid() && prod.best_bid() != ref.best_bid())) {
      fail("best_bid diverged");
      return false;
    }
    if (prod.has_ask() != ref.has_ask() || (prod.has_ask() && prod.best_ask() != ref.best_ask())) {
      fail("best_ask diverged");
      return false;
    }
    if (!orders_match(snapshot(prod), ref.resting_orders())) {
      fail("resting order set diverged");
      return false;
    }
  }

  std::printf("differential fuzzer OK: seed=%llu iterations=%llu\n",
              static_cast<unsigned long long>(seed), static_cast<unsigned long long>(iterations));
  return true;
}

} // namespace

int main(int argc, char** argv) {
  Args args = parse_args(argc, argv);
  return run(args.seed, args.iterations) ? 0 : 1;
}
