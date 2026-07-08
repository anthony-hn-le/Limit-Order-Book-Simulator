include(FetchContent)
set(BENCHMARK_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
set(BENCHMARK_ENABLE_INSTALL OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
  benchmark
  GIT_REPOSITORY https://github.com/google/benchmark.git
  GIT_TAG v1.9.1
)
FetchContent_MakeAvailable(benchmark)

add_executable(lob_bench
  bench_main.cpp
  bench_insert.cpp
  bench_cancel.cpp
  bench_match.cpp
  bench_throughput.cpp
)
target_link_libraries(lob_bench PRIVATE lob_engine benchmark::benchmark)
