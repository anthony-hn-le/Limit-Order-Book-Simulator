#include <gtest/gtest.h>

#include "lob/order_book.hpp"
#include "recording_listener.hpp"

using namespace lob;
using lob::testing::RecordingListener;

TEST(PriceTimePriority, SamePriceFillsInArrivalOrder) {
  RecordingListener listener;
  OrderBook book(&listener);

  OrderId first = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/1);
  OrderId second = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/2);

  book.submit_limit_order(Side::Buy, 100, 15, /*client=*/3);

  ASSERT_EQ(listener.trades.size(), 2u);
  EXPECT_EQ(listener.trades[0].resting_id, first);
  EXPECT_EQ(listener.trades[0].quantity, 10u);
  EXPECT_EQ(listener.trades[1].resting_id, second);
  EXPECT_EQ(listener.trades[1].quantity, 5u);
}

TEST(PriceTimePriority, BetterPriceBeatsEarlierTime) {
  RecordingListener listener;
  OrderBook book(&listener);

  OrderId early_worse = book.submit_limit_order(Side::Sell, 101, 10, /*client=*/1);
  OrderId later_better = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/2);

  book.submit_limit_order(Side::Buy, 101, 10, /*client=*/3);

  ASSERT_EQ(listener.trades.size(), 1u);
  EXPECT_EQ(listener.trades[0].resting_id, later_better);
  EXPECT_EQ(listener.trades[0].price, 100);
  (void)early_worse;
}

TEST(PriceTimePriority, PartialFillRetainsQueuePosition) {
  RecordingListener listener;
  OrderBook book(&listener);

  OrderId resting = book.submit_limit_order(Side::Sell, 100, 20, /*client=*/1);
  book.submit_limit_order(Side::Sell, 100, 10, /*client=*/2);

  // First aggressor takes only part of `resting`'s quantity.
  book.submit_limit_order(Side::Buy, 100, 5, /*client=*/3);
  ASSERT_EQ(listener.trades.size(), 1u);
  EXPECT_EQ(listener.trades[0].resting_id, resting);
  EXPECT_EQ(listener.trades[0].quantity, 5u);

  // A second aggressor should still hit the partially-filled `resting`
  // order first -- it must not have lost its place in the queue.
  book.submit_limit_order(Side::Buy, 100, 5, /*client=*/4);
  ASSERT_EQ(listener.trades.size(), 2u);
  EXPECT_EQ(listener.trades[1].resting_id, resting);
  EXPECT_EQ(listener.trades[1].quantity, 5u);
}

TEST(PriceTimePriority, AggressorSweepsMultipleLevels) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 5, /*client=*/1);
  book.submit_limit_order(Side::Sell, 101, 5, /*client=*/2);

  OrderId aggressor = book.submit_limit_order(Side::Buy, 101, 10, /*client=*/3);

  ASSERT_EQ(listener.trades.size(), 2u);
  EXPECT_EQ(listener.trades[0].price, 100);
  EXPECT_EQ(listener.trades[1].price, 101);
  for (const auto& trade : listener.trades) {
    EXPECT_EQ(trade.aggressor_id, aggressor);
  }
  EXPECT_FALSE(book.has_bid());
  EXPECT_FALSE(book.has_ask());
}

TEST(PriceTimePriority, NonCrossingLimitOrderRests) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Buy, 99, 10, /*client=*/1);

  EXPECT_TRUE(listener.trades.empty());
  ASSERT_TRUE(book.has_bid());
  EXPECT_EQ(book.best_bid(), 99);
}
