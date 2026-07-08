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
// Embind-bound C++ instances need explicit disposal (they're not GC'd by
// the JS engine, since the underlying memory lives in WASM linear memory) --
// relevant now that LobSimulatorApp can be fully remounted via the Reset
// button, which creates a fresh engine on every reset. Not part of the
// public LobEngineHandle type (that's the app's own domain surface), so
// accessed via a narrow local cast rather than widening that type.
interface Disposable {
  delete?: () => void;
}

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
      (engineRef.current as Disposable | null)?.delete?.();
      engineRef.current = null;
    };
  }, []);

  return { engineRef, ready };
}
