#include <gtest/gtest.h>

#include "lob/order_book.hpp"
#include "recording_listener.hpp"

using namespace lob;
using lob::testing::RecordingListener;

TEST(Cancel, RemovesOrderWithoutDisturbingSiblings) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 10, /*client=*/1);
  OrderId victim = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/2);
  OrderId survivor = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/3);

  ASSERT_TRUE(book.cancel_order(victim));
  EXPECT_EQ(book.order_count(), 2u);

  // A buy that would only satisfy the first two original orders' worth of
  // quantity should skip the cancelled one and reach `survivor`.
  book.submit_limit_order(Side::Buy, 100, 20, /*client=*/4);
  ASSERT_EQ(listener.trades.size(), 2u);
  EXPECT_EQ(listener.trades[1].resting_id, survivor);
}

TEST(Cancel, UnknownIdIsANoOp) {
  OrderBook book;
  EXPECT_FALSE(book.cancel_order(999999));
}

TEST(Cancel, LastOrderAtLevelRemovesTheLevel) {
  RecordingListener listener;
  OrderBook book(&listener);

  OrderId only = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/1);
  ASSERT_TRUE(book.cancel_order(only));
  EXPECT_EQ(book.ask_level_count(), 0u);

  // A fresh order at the same price should start a clean level, not
  // resurrect any state from the cancelled one.
  book.submit_limit_order(Side::Sell, 100, 5, /*client=*/2);
  EXPECT_EQ(book.ask_level_count(), 1u);
  EXPECT_EQ(book.best_ask(), 100);
}

TEST(Cancel, CancellingAlreadyFilledOrderFails) {
  OrderBook book;
  OrderId resting = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/1);
  book.submit_limit_order(Side::Buy, 100, 10, /*client=*/2);

  EXPECT_FALSE(book.cancel_order(resting));
}
