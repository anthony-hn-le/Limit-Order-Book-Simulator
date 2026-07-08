#include <gtest/gtest.h>

#include "lob/order_book.hpp"
#include "recording_listener.hpp"

using namespace lob;
using lob::testing::RecordingListener;

// Policy: cancel-newest STP. The incoming (always-newer) order's remaining
// quantity is rejected on a self-cross; the resting order is untouched.
TEST(SelfTradePrevention, RejectsIncomingOrderOnSelfCross) {
  RecordingListener listener;
  OrderBook book(&listener);

  OrderId resting = book.submit_limit_order(Side::Sell, 100, 10, /*client=*/7);
  OrderId incoming = book.submit_limit_order(Side::Buy, 100, 10, /*client=*/7);

  EXPECT_TRUE(listener.trades.empty());
  ASSERT_EQ(listener.rejected.size(), 1u);
  EXPECT_EQ(listener.rejected[0].first.id, incoming);
  EXPECT_EQ(listener.rejected[0].second, RejectReason::SelfTradePrevented);

  // The resting order must still be there, untouched.
  EXPECT_TRUE(book.has_ask());
  EXPECT_EQ(book.best_ask(), 100);
  EXPECT_TRUE(book.cancel_order(resting));
}

TEST(SelfTradePrevention, DifferentClientsMatchNormally) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 10, /*client=*/1);
  book.submit_limit_order(Side::Buy, 100, 10, /*client=*/2);

  ASSERT_EQ(listener.trades.size(), 1u);
  EXPECT_TRUE(listener.rejected.empty());
}

TEST(SelfTradePrevention, IncomingRemainderNotRestedAfterStp) {
  RecordingListener listener;
  OrderBook book(&listener);

  book.submit_limit_order(Side::Sell, 100, 5, /*client=*/9);
  book.submit_limit_order(Side::Buy, 100, 10, /*client=*/9);

  // The self-cross halts the incoming order entirely rather than resting
  // any remainder, which would otherwise immediately self-cross again.
  EXPECT_FALSE(book.has_bid());
}
