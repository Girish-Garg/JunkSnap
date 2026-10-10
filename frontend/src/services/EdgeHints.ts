import type { CapabilityProbe, ProbeVerdict } from './CapabilityProbe';
import type { EdgeDetector } from './EdgeDetector';
import type { EdgeHintsPreference } from './EdgeHintsPreference';

/** Builds the detector (and so the worker) only when asked; nothing loads at startup. */
export type DetectorFactory = (threads: number) => EdgeDetector;

export interface EdgeReady {
  readonly detector: EdgeDetector;
  readonly warmMs: number;
  readonly backend: string;
}

/**
 * Edge or cloud mode. Edge needs the startup probe to pass, the setting on, and the warm-up
 * inference to beat the budget; otherwise the app behaves exactly as without a model.
 */
export class EdgeHints {
  readonly #probe: CapabilityProbe;
  readonly #preference: EdgeHintsPreference;
  readonly #factory: DetectorFactory;
  #ready: Promise<EdgeReady | null> | null = null;
  #verdict: ProbeVerdict;

  constructor(probe: CapabilityProbe, preference: EdgeHintsPreference, factory: DetectorFactory) {
    this.#probe = probe;
    this.#preference = preference;
    this.#factory = factory;
    this.#verdict = probe.startup();
  }

  /** The device could run hints (the setting is shown only then). */
  supported(): boolean {
    return this.#verdict.ok;
  }

  verdict(): ProbeVerdict {
    return this.#verdict;
  }

  enabled(): boolean {
    return this.supported() && this.#preference.on();
  }

  get preference(): EdgeHintsPreference {
    return this.#preference;
  }

  /** The loaded detector, loading it the first time; null in cloud mode or when the warm-up is too slow. */
  open(): Promise<EdgeReady | null> {
    if (!this.enabled()) return Promise.resolve(null);
    this.#ready ??= this.#load();
    return this.#ready;
  }

  async #load(): Promise<EdgeReady | null> {
    const detector = this.#factory(this.#probe.threads());
    try {
      const { warmMs, backend } = await detector.load();
      this.#verdict = this.#probe.afterWarmup(warmMs);
      if (this.#verdict.ok) return { detector, warmMs, backend };
    } catch {
      this.#verdict = { ok: false, reason: 'load_failed' };
    }
    detector.dispose();
    return null;
  }
}
