include(FetchContent)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.15.2
)
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

add_executable(lob_unit_tests
  unit/test_price_time_priority.cpp
  unit/test_cancel.cpp
  unit/test_market_orders.cpp
  unit/test_self_cross.cpp
  unit/test_events.cpp
)
target_link_libraries(lob_unit_tests PRIVATE lob_engine GTest::gtest_main)
target_include_directories(lob_unit_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

include(GoogleTest)
gtest_discover_tests(lob_unit_tests)

add_executable(lob_differential_fuzzer
  fuzz/naive_reference_book.cpp
  fuzz/differential_fuzzer.cpp
)
target_link_libraries(lob_differential_fuzzer PRIVATE lob_engine)

# Fixed-seed run wired in as a required CI check (see .github/workflows/ci.yml).
add_test(NAME differential_fuzz_fixed_seed
         COMMAND lob_differential_fuzzer --seed 42 --iterations 100000)
