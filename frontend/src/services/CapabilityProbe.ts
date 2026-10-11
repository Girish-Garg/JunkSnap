import { CAPTURE_DEFAULTS, type CaptureSettings } from '../config/CaptureSettings';

/** What the page can do, read once at startup; cheap checks only, nothing is downloaded. */
export interface DeviceCapabilities {
  readonly wasmSimd: boolean;
  readonly worker: boolean;
  readonly offscreenCanvas: boolean;
  readonly imageBitmap: boolean;
  /** navigator.deviceMemory in GB; undefined where the browser hides it (Safari, Firefox). */
  readonly memoryGb: number | undefined;
  readonly cores: number;
  readonly crossOriginIsolated: boolean;
}

export type ProbeFailure = 'no_wasm_simd' | 'no_worker' | 'no_offscreen_canvas' | 'low_memory' | 'too_slow' | 'load_failed';

export interface ProbeVerdict {
  readonly ok: boolean;
  readonly reason: ProbeFailure | null;
}

/**
 * The probe's bars (the config's capture settings): below minMemoryGb the phone keeps its memory for the camera and
 * the map; a warm inference slower than warmupBudgetMs cannot keep live boxes near 4 fps, so the app stays in cloud mode.
 */
export type ProbeLimits = Pick<CaptureSettings, 'minMemoryGb' | 'warmupBudgetMs'>;

// The smallest module that uses a SIMD instruction (i32x4.splat); WebAssembly.validate rejects it without SIMD.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

interface ProbeGlobals {
  readonly WebAssembly?: { validate(bytes: BufferSource): boolean };
  readonly Worker?: unknown;
  readonly OffscreenCanvas?: unknown;
  readonly createImageBitmap?: unknown;
  readonly crossOriginIsolated?: boolean;
  readonly navigator?: { readonly deviceMemory?: number; readonly hardwareConcurrency?: number };
}

const OK: ProbeVerdict = { ok: true, reason: null };
const fail = (reason: ProbeFailure): ProbeVerdict => ({ ok: false, reason });

/** Decides edge mode: the startup checks, then the warm-up inference when the camera first opens. */
export class CapabilityProbe {
  /** A page with none of it, such as tests: always cloud mode. */
  static readonly NONE: DeviceCapabilities = {
    wasmSimd: false,
    worker: false,
    offscreenCanvas: false,
    imageBitmap: false,
    memoryGb: undefined,
    cores: 1,
    crossOriginIsolated: false,
  };

  readonly #capabilities: DeviceCapabilities;
  readonly #limits: ProbeLimits;
  readonly #startup: ProbeVerdict;

  constructor(capabilities: DeviceCapabilities, limits: ProbeLimits = CAPTURE_DEFAULTS) {
    this.#capabilities = capabilities;
    this.#limits = limits;
    this.#startup = CapabilityProbe.#judge(capabilities, limits);
  }

  static read(globals: ProbeGlobals): DeviceCapabilities {
    return {
      wasmSimd: CapabilityProbe.#simd(globals),
      worker: typeof globals.Worker === 'function',
      offscreenCanvas: typeof globals.OffscreenCanvas === 'function',
      imageBitmap: typeof globals.createImageBitmap === 'function',
      memoryGb: globals.navigator?.deviceMemory,
      cores: globals.navigator?.hardwareConcurrency ?? 1,
      crossOriginIsolated: globals.crossOriginIsolated === true,
    };
  }

  startup(): ProbeVerdict {
    return this.#startup;
  }

  /** The final word once the model has run its warm-up. */
  afterWarmup(warmMs: number): ProbeVerdict {
    if (!this.#startup.ok) return this.#startup;
    return warmMs < this.#limits.warmupBudgetMs ? OK : fail('too_slow');
  }

  /** WASM threads need SharedArrayBuffer, which needs a cross-origin isolated page; else one thread. */
  threads(): number {
    const { crossOriginIsolated, cores } = this.#capabilities;
    return crossOriginIsolated ? Math.max(1, Math.min(4, Math.floor(cores / 2))) : 1;
  }

  static #judge(device: DeviceCapabilities, limits: ProbeLimits): ProbeVerdict {
    if (!device.wasmSimd) return fail('no_wasm_simd');
    if (!device.worker) return fail('no_worker');
    if (!device.offscreenCanvas || !device.imageBitmap) return fail('no_offscreen_canvas');
    if (device.memoryGb !== undefined && device.memoryGb < limits.minMemoryGb) return fail('low_memory');
    return OK;
  }

  static #simd(globals: ProbeGlobals): boolean {
    try {
      return globals.WebAssembly?.validate(SIMD_PROBE) === true;
    } catch {
      return false;
    }
  }
}
