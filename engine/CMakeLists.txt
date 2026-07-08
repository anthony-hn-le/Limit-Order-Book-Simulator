add_library(lob_engine STATIC
  src/order_book.cpp
  src/order_flow_generator.cpp
)

target_include_directories(lob_engine PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_compile_options(lob_engine PRIVATE
  -Wall -Wextra -Wpedantic
)
