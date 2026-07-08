"use client";

import { useEffect, useRef, useState } from "react";
import type { LobEngineHandle } from "./types";

// The embind glue (public/wasm/lob_engine.js) references `window` at
// module-eval time, so it's loaded once per mount inside an effect, not
// via a static top-level import -- this file itself is only ever reached
// from a component that's already been kept off the server render via
// next/dynamic({ ssr: false }) (see LobSimulatorApp's usage in page.tsx).
//
// The path is a public/ static asset, not a bundler-resolvable module, so
// webpackIgnore/turbopackIgnore tell the bundler to leave the import
// expression as a literal runtime browser import rather than trying (and
// failing) to resolve it at build time.
export function useLobEngine() {
  const engineRef = useRef<LobEngineHandle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // @ts-expect-error -- runtime-only public asset (built by wasm/build.sh), not a bundler-resolvable module
      const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/wasm/lob_engine.js");
      const createModule = mod.default as () => Promise<{ LobEngine: new () => LobEngineHandle }>;
      const Module = await createModule();
      if (cancelled) return;
      engineRef.current = new Module.LobEngine();
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { engineRef, ready };
}
