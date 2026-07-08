cmake_minimum_required(VERSION 3.20)
project(LimitOrderBookSimulator CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

option(LOB_BUILD_TESTS "Build unit and fuzz tests" ON)
option(LOB_BUILD_BENCH "Build benchmark suite" ON)
option(LOB_BUILD_CLI "Build the lob-cli replay/demo tool" ON)

add_subdirectory(engine)

if(LOB_BUILD_CLI)
  add_subdirectory(cli)
endif()

if(LOB_BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()

if(LOB_BUILD_BENCH)
  add_subdirectory(bench)
endif()
