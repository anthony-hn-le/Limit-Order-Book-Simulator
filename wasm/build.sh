#!/usr/bin/env bash
# Builds the embind WASM module and drops it into web/public/wasm/, where
# the Next.js frontend loads it via next/dynamic({ ssr: false }).
set -euo pipefail
cd "$(dirname "$0")"

OUT_DIR="../web/public/wasm"
mkdir -p "$OUT_DIR"

emcc -O3 -flto \
  --bind \
  -std=c++20 \
  -I ../engine/include \
  ../engine/src/order_book.cpp \
  bindings.cpp \
  -o "$OUT_DIR/lob_engine.js" \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORT_NAME=createLobEngineModule

echo "Built $OUT_DIR/lob_engine.js (+ .wasm)"
