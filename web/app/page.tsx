"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// The WASM glue references `window` at module-eval time, so the whole
// interactive app is kept off the server render entirely (ssr: false is
// only valid inside a Client Component, hence 'use client' on this file).
const LobSimulatorApp = dynamic(() => import("./components/LobSimulatorApp"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
      <div className="spinner" />
    </div>
  ),
});

export default function Page() {
  // Reset is implemented as a full remount rather than threading reset
  // logic through every hook (engine, ambient bot, ledger) individually --
  // bumping the key unmounts the old instance (a fresh WASM LobEngine,
  // fresh account ledger, fresh everything) and mounts a brand new one,
  // which is the only way to guarantee no stale state survives anywhere.
  const [instanceKey, setInstanceKey] = useState(0);

  return <LobSimulatorApp key={instanceKey} onReset={() => setInstanceKey((k) => k + 1)} />;
}
