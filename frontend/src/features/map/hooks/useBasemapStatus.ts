import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import type { BasemapSignal } from '../BasemapWatch';
import type { BasemapPhase } from '../MapNotice';

type Stage = 'loading' | 'waiting' | 'slow';

/** How long load number `load` has run, as a stage (map.loadingAfterMs, map.slowAfterMs); each new load starts the clock again. */
function useLoadClock(load: number, running: boolean): Stage {
  const { loadingAfterMs, slowAfterMs } = useConfig().map;
  const [clock, setClock] = useState<{ readonly load: number; readonly stage: Stage }>({ load, stage: 'loading' });
  useEffect(() => {
    if (!running) return undefined;
    const at = (stage: Stage, ms: number) => setTimeout(() => setClock({ load, stage }), ms);
    const timers = [at('waiting', loadingAfterMs), at('slow', slowAfterMs)];
    return () => timers.forEach(clearTimeout);
  }, [load, running, loadingAfterMs, slowAfterMs]);
  return clock.load === load ? clock.stage : 'loading';
}

export interface BasemapStatus {
  readonly phase: BasemapPhase;
  /** After a failure: asks the map for its style again. */
  readonly retry: () => void;
  /** For the map (SiteMapBindings): it reports here, and reloads its style when the retries go up. */
  readonly bindings: { readonly onBasemap: (signal: BasemapSignal) => void; readonly basemapRetries: number };
}

/** The basemap's load as the map reports it (BasemapWatch), timed for the toast. */
export function useBasemapStatus(): BasemapStatus {
  const [state, setState] = useState<{ readonly signal: BasemapSignal | null; readonly load: number }>({ signal: null, load: 0 });
  const [retries, setRetries] = useState(0);
  const onBasemap = useCallback((signal: BasemapSignal) => {
    setState((last) => ({ signal, load: signal === 'loading' ? last.load + 1 : last.load }));
  }, []);
  const retry = useCallback(() => {
    setRetries((count) => count + 1);
    onBasemap('loading');
  }, [onBasemap]);
  const stage = useLoadClock(state.load, state.signal === 'loading');
  const phase = state.signal === 'loading' ? stage : (state.signal ?? 'idle');
  return { phase, retry, bindings: { onBasemap, basemapRetries: retries } };
}
