// lob-cli: terminal demo/driver for the matching engine.
//
//   lob-cli replay --seed 42 --arrival-rate 500 --count 500
//       Drives OrderFlowGenerator live against a real OrderBook, redrawing
//       a text-mode ladder and trade tape as events arrive. A genuinely
//       showable checkpoint before any web/WASM code exists.
//
//   lob-cli bench-drive --seed 42 --count 1000000 --output orders.jsonl
//       Dumps a deterministic event sequence to a file, reusable as a
//       fixed benchmark-driver corpus or a saved regression case.

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <fstream>
#include <random>
#include <string>
#include <thread>
#include <tuple>
#include <vector>

#include "lob/order_book.hpp"
#include "lob/order_flow_generator.hpp"

using namespace lob;

namespace {

struct TapeListener : IEventListener {
  std::deque<Trade> tape;
  size_t capacity;
  explicit TapeListener(size_t cap) : capacity(cap) {}
  void on_trade(const Trade& t) override {
    tape.push_back(t);
    if (tape.size() > capacity) tape.pop_front();
  }
};

void print_ladder(const OrderBook& book, size_t depth) {
  std::vector<std::tuple<Price, Quantity>> bids, asks;
  book.for_each_bid([&](Price p, Quantity q, size_t) {
    if (bids.size() < depth) bids.emplace_back(p, q);
  });
  book.for_each_ask([&](Price p, Quantity q, size_t) {
    if (asks.size() < depth) asks.emplace_back(p, q);
  });

  std::printf("%-10s %-10s | %-10s %-10s\n", "BID_QTY", "BID_PX", "ASK_PX", "ASK_QTY");
  std::printf("--------------------------------------------\n");
  size_t rows = std::max(bids.size(), asks.size());
  for (size_t i = 0; i < rows; ++i) {
    if (i < bids.size()) {
      std::printf("%-10llu %-10lld | ", static_cast<unsigned long long>(std::get<1>(bids[i])),
                  static_cast<long long>(std::get<0>(bids[i])));
    } else {
      std::printf("%-10s %-10s | ", "", "");
    }
    if (i < asks.size()) {
      std::printf("%-10lld %-10llu\n", static_cast<long long>(std::get<0>(asks[i])),
                  static_cast<unsigned long long>(std::get<1>(asks[i])));
    } else {
      std::printf("\n");
    }
  }
}

void print_tape(const std::deque<Trade>& tape, size_t show) {
  std::printf("\n-- trade tape (most recent %zu) --\n", show);
  size_t start = tape.size() > show ? tape.size() - show : 0;
  for (size_t i = start; i < tape.size(); ++i) {
    const Trade& t = tape[i];
    std::printf("  trade #%-6llu px=%-8lld qty=%-6llu  aggressor=%-6llu resting=%llu\n",
                static_cast<unsigned long long>(t.id), static_cast<long long>(t.price),
                static_cast<unsigned long long>(t.quantity),
                static_cast<unsigned long long>(t.aggressor_id),
                static_cast<unsigned long long>(t.resting_id));
  }
}

struct ReplayArgs {
  std::uint64_t seed = 42;
  double arrival_rate = 200.0;
  std::uint64_t count = 500;
  std::uint64_t redraw_every = 25;
  size_t ladder_depth = 8;
  bool clear_screen = true;
  int sleep_ms = 60;
};

int run_replay(int argc, char** argv) {
  ReplayArgs args;
  for (int i = 0; i < argc; ++i) {
    if (std::strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
      args.seed = std::strtoull(argv[++i], nullptr, 10);
    } else if (std::strcmp(argv[i], "--arrival-rate") == 0 && i + 1 < argc) {
      args.arrival_rate = std::strtod(argv[++i], nullptr);
    } else if (std::strcmp(argv[i], "--count") == 0 && i + 1 < argc) {
      args.count = std::strtoull(argv[++i], nullptr, 10);
    } else if (std::strcmp(argv[i], "--no-clear") == 0) {
      args.clear_screen = false;
    } else if (std::strcmp(argv[i], "--sleep-ms") == 0 && i + 1 < argc) {
      args.sleep_ms = std::atoi(argv[++i]);
    }
  }

  GeneratorConfig config;
  config.arrival_rate = args.arrival_rate;
  OrderFlowGenerator generator(config, args.seed);

  TapeListener listener(50);
  OrderBook book(&listener);
  std::vector<OrderId> live_ids;
  std::mt19937_64 cancel_rng(args.seed ^ 0x9e3779b97f4a7c15ULL);
  std::mt19937_64 client_rng(args.seed ^ 0xbf58476d1ce4e5b9ULL);
  // A pool of distinct synthetic participants, not one -- a single
  // client_id would make every crossing order a self-trade, which STP
  // (cancel-newest) then silently drops instead of matching or resting.
  std::uniform_int_distribution<ClientId> client_dist(1, 20);

  for (std::uint64_t i = 0; i < args.count; ++i) {
    GeneratedEvent event = generator.next();

    if (event.type == GeneratedEventType::Cancel) {
      if (!live_ids.empty()) {
        std::uniform_int_distribution<size_t> idx_dist(0, live_ids.size() - 1);
        size_t idx = idx_dist(cancel_rng);
        OrderId id = live_ids[idx];
        if (book.cancel_order(id)) {
          live_ids.erase(live_ids.begin() + static_cast<long>(idx));
        }
      }
    } else {
      ClientId client = client_dist(client_rng);
      if (event.order_type == OrderType::Market) {
        book.submit_market_order(event.side, event.quantity, client);
      } else {
        OrderId id = book.submit_limit_order(event.side, event.price, event.quantity, client);
        live_ids.push_back(id);
      }
    }

    bool last = (i + 1 == args.count);
    if ((i + 1) % args.redraw_every == 0 || last) {
      if (args.clear_screen) std::printf("\033[2J\033[H");
      std::printf("lob-cli replay -- seed=%llu event=%llu/%llu\n\n",
                  static_cast<unsigned long long>(args.seed), static_cast<unsigned long long>(i + 1),
                  static_cast<unsigned long long>(args.count));
      print_ladder(book, args.ladder_depth);
      print_tape(listener.tape, 15);
      std::fflush(stdout);
      if (!last && args.sleep_ms > 0) {
        std::this_thread::sleep_for(std::chrono::milliseconds(args.sleep_ms));
      }
    }
  }
  return 0;
}

struct BenchDriveArgs {
  std::uint64_t seed = 42;
  std::uint64_t count = 1'000'000;
  std::string output = "orders.jsonl";
};

int run_bench_drive(int argc, char** argv) {
  BenchDriveArgs args;
  for (int i = 0; i < argc; ++i) {
    if (std::strcmp(argv[i], "--seed") == 0 && i + 1 < argc) {
      args.seed = std::strtoull(argv[++i], nullptr, 10);
    } else if (std::strcmp(argv[i], "--count") == 0 && i + 1 < argc) {
      args.count = std::strtoull(argv[++i], nullptr, 10);
    } else if (std::strcmp(argv[i], "--output") == 0 && i + 1 < argc) {
      args.output = argv[++i];
    }
  }

  GeneratorConfig config;
  OrderFlowGenerator generator(config, args.seed);
  std::ofstream out(args.output);
  if (!out) {
    std::fprintf(stderr, "failed to open %s for writing\n", args.output.c_str());
    return 1;
  }

  for (std::uint64_t i = 0; i < args.count; ++i) {
    GeneratedEvent event = generator.next();
    if (event.type == GeneratedEventType::Cancel) {
      out << "{\"op\":\"cancel\"}\n";
    } else {
      const char* type_str = (event.order_type == OrderType::Market) ? "market" : "limit";
      const char* side_str = (event.side == Side::Buy) ? "buy" : "sell";
      out << "{\"op\":\"new\",\"type\":\"" << type_str << "\",\"side\":\"" << side_str
          << "\",\"price\":" << event.price << ",\"quantity\":" << event.quantity << "}\n";
    }
  }
  std::printf("wrote %llu events to %s (seed=%llu)\n", static_cast<unsigned long long>(args.count),
              args.output.c_str(), static_cast<unsigned long long>(args.seed));
  return 0;
}

} // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lob-cli <replay|bench-drive> [options]\n");
    return 1;
  }
  std::string subcommand = argv[1];
  if (subcommand == "replay") {
    return run_replay(argc - 2, argv + 2);
  }
  if (subcommand == "bench-drive") {
    return run_bench_drive(argc - 2, argv + 2);
  }
  std::fprintf(stderr, "unknown subcommand '%s'\n", subcommand.c_str());
  return 1;
}
