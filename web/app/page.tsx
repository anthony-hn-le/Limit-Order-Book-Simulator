"use client";

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
  return <LobSimulatorApp />;
}
