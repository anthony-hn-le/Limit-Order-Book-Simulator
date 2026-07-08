#include <gtest/gtest.h>

#include "lob/order_book.hpp"
#include "recording_listener.hpp"

using namespace lob;
using lob::testing::RecordingListener;

TEST(MarketOrders, SweepsAcrossLevelsAtRestingPrices) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 5, /*client=*/1);
  book.submit_limit_order(Side::Sell, 101, 5, /*client=*/2);

  book.submit_market_order(Side::Buy, 10, /*client=*/3);

  ASSERT_EQ(listener.trades.size(), 2u);
  EXPECT_EQ(listener.trades[0].price, 100);
  EXPECT_EQ(listener.trades[1].price, 101);
  EXPECT_FALSE(book.has_ask());
}

TEST(MarketOrders, InsufficientLiquidityDropsRemainder) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 5, /*client=*/1);

  book.submit_market_order(Side::Buy, 20, /*client=*/2);

  ASSERT_EQ(listener.trades.size(), 1u);
  EXPECT_EQ(listener.trades[0].quantity, 5u);
  ASSERT_EQ(listener.rejected.size(), 1u);
  EXPECT_EQ(listener.rejected[0].second, RejectReason::UnfilledRemainder);
  EXPECT_EQ(listener.rejected[0].first.remaining, 15u);

  // Nothing should have rested from the unfilled remainder.
  EXPECT_FALSE(book.has_bid());
}

TEST(MarketOrders, EmptyBookRejectsEntireOrder) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_market_order(Side::Sell, 10, /*client=*/1);

  EXPECT_TRUE(listener.trades.empty());
  ASSERT_EQ(listener.rejected.size(), 1u);
  EXPECT_EQ(listener.rejected[0].first.remaining, 10u);
}

TEST(MarketOrders, DoesNotRequirePriceToCross) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 1'000'000, 5, /*client=*/1);
  book.submit_market_order(Side::Buy, 5, /*client=*/2);

  ASSERT_EQ(listener.trades.size(), 1u);
  EXPECT_EQ(listener.trades[0].price, 1'000'000);
}
