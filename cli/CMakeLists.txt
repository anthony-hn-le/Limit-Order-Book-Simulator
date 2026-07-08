add_executable(lob-cli lob_cli.cpp)
target_link_libraries(lob-cli PRIVATE lob_engine)
target_compile_options(lob-cli PRIVATE -Wall -Wextra -Wpedantic)
