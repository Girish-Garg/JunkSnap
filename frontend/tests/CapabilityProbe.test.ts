import { describe, expect, it } from 'vitest';
import { CapabilityProbe, type DeviceCapabilities } from '../src/services/CapabilityProbe';
import { DEFAULTS } from './config';

const { warmupBudgetMs } = DEFAULTS.capture;

const PHONE: DeviceCapabilities = {
  wasmSimd: true,
  worker: true,
  offscreenCanvas: true,
  imageBitmap: true,
  memoryGb: 4,
  cores: 8,
  crossOriginIsolated: false,
};

describe('CapabilityProbe at startup', () => {
  it('passes a phone with WASM SIMD, workers, OffscreenCanvas and enough memory', () => {
    expect(new CapabilityProbe(PHONE).startup()).toEqual({ ok: true, reason: null });
  });

  it.each([
    [{ wasmSimd: false }, 'no_wasm_simd'],
    [{ worker: false }, 'no_worker'],
    [{ offscreenCanvas: false }, 'no_offscreen_canvas'],
    [{ imageBitmap: false }, 'no_offscreen_canvas'],
    [{ memoryGb: 1 }, 'low_memory'],
  ] as const)('falls back to cloud mode when %o', (change, reason) => {
    expect(new CapabilityProbe({ ...PHONE, ...change }).startup()).toEqual({ ok: false, reason });
  });

  it('does not hold a hidden deviceMemory against the device', () => {
    expect(new CapabilityProbe({ ...PHONE, memoryGb: undefined }).startup().ok).toBe(true);
  });

  it('a page without any of it (tests, old browsers) is cloud mode', () => {
    expect(new CapabilityProbe(CapabilityProbe.NONE).startup().ok).toBe(false);
  });

  it('reads the real globals: Node has WASM SIMD but no OffscreenCanvas', () => {
    const read = CapabilityProbe.read({ WebAssembly, navigator: { hardwareConcurrency: 4 } });
    expect(read).toMatchObject({ wasmSimd: true, offscreenCanvas: false, cores: 4, crossOriginIsolated: false });
  });
});

describe('CapabilityProbe after the warm-up', () => {
  it('keeps edge mode only when the warm inference beats the budget', () => {
    const probe = new CapabilityProbe(PHONE);
    expect(probe.afterWarmup(warmupBudgetMs - 1).ok).toBe(true);
    expect(probe.afterWarmup(warmupBudgetMs)).toEqual({ ok: false, reason: 'too_slow' });
  });

  it('never lets a fast warm-up override a failed startup check', () => {
    expect(new CapabilityProbe({ ...PHONE, worker: false }).afterWarmup(5)).toEqual({ ok: false, reason: 'no_worker' });
  });

  it('uses one WASM thread unless the page is cross-origin isolated', () => {
    expect(new CapabilityProbe(PHONE).threads()).toBe(1);
    expect(new CapabilityProbe({ ...PHONE, crossOriginIsolated: true }).threads()).toBe(4);
  });
});
