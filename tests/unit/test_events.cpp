#include <gtest/gtest.h>

#include "lob/order_book.hpp"
#include "recording_listener.hpp"

using namespace lob;
using lob::testing::RecordingListener;

TEST(Events, AcceptedFiresOnEverySubmission) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Buy, 100, 10, /*client=*/1);
  book.submit_market_order(Side::Sell, 5, /*client=*/2);

  EXPECT_EQ(listener.accepted.size(), 2u);
}

TEST(Events, CancelledFiresExactlyOnce) {
  RecordingListener listener;
  OrderBook book(&listener);

  OrderId id = book.submit_limit_order(Side::Buy, 100, 10, /*client=*/1);
  book.cancel_order(id);
  book.cancel_order(id); // no-op, must not double-fire

  EXPECT_EQ(listener.cancelled.size(), 1u);
}

TEST(Events, FullMatchSequenceIsAcceptTrade) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 10, /*client=*/1);
  book.submit_limit_order(Side::Buy, 100, 10, /*client=*/2);

  ASSERT_EQ(listener.accepted.size(), 2u);
  ASSERT_EQ(listener.trades.size(), 1u);
  EXPECT_TRUE(listener.cancelled.empty());
  EXPECT_TRUE(listener.rejected.empty());
}

TEST(Events, CancelledOrderKeepsOriginalQuantityInEvent) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 20, /*client=*/1);
  book.submit_limit_order(Side::Buy, 100, 5, /*client=*/2); // partial fill

  OrderId resting = listener.accepted[0].id;
  book.cancel_order(resting);

  ASSERT_EQ(listener.cancelled.size(), 1u);
  EXPECT_EQ(listener.cancelled[0].remaining, 15u);
}
