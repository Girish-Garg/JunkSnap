import { describe, expect, it, vi } from 'vitest';
import type { EdgeReply, EdgeRequest } from '../src/domain/EdgeProtocol';
import { CapabilityProbe, type DeviceCapabilities } from '../src/services/CapabilityProbe';
import { EdgeDetector, type FrameGrabber, type WorkerLike } from '../src/services/EdgeDetector';
import { EdgeHints } from '../src/services/EdgeHints';
import { EdgeHintsPreference } from '../src/services/EdgeHintsPreference';
import { EdgeWorkerHost, type ModelRunner } from '../src/workers/EdgeWorkerHost';
import { MemoryStore } from './helpers';

const bitmap = () => ({ width: 240, height: 320, close: vi.fn() }) as unknown as ImageBitmap;

/** A worker whose other side is a real EdgeWorkerHost around a fake model, as in the browser. */
class LoopbackWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<EdgeReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly sent: EdgeRequest[] = [];
  terminated = false;
  readonly #host: EdgeWorkerHost;

  constructor(runner: ModelRunner) {
    this.#host = new EdgeWorkerHost(runner, (reply) => this.onmessage?.({ data: reply } as MessageEvent<EdgeReply>), () => 0);
  }

  postMessage(message: EdgeRequest): void {
    this.sent.push(message);
    void this.#host.handle(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

function fakeRunner(warmMs: number[] = [300, 40], rows: number[] = [40, 160, 280, 320, 0.62, 0]): ModelRunner {
  const warm = [...warmMs];
  return { load: vi.fn(async () => 'wasm x1'), warmUp: vi.fn(async () => warm.shift() ?? 0), detect: vi.fn(async () => rows) };
}

const grabber: FrameGrabber = { grab: async () => ({ bitmap: bitmap(), width: 720, height: 960 }) };
const video = {} as HTMLVideoElement;

function detector(runner: ModelRunner) {
  const worker = new LoopbackWorker(runner);
  return { worker, detector: new EdgeDetector({ worker, grabber, modelUrl: '/models/edge-int8.onnx', threads: 1, now: () => 5_000 }) };
}

describe('EdgeDetector and the worker', () => {
  it('loads the model, then times the second warm-up run', async () => {
    const { worker, detector: edge } = detector(fakeRunner());
    await expect(edge.load()).resolves.toEqual({ kind: 'ready', warmMs: 40, backend: 'wasm x1' });
    expect(worker.sent[0]).toEqual({ kind: 'load', modelUrl: '/models/edge-int8.onnx', threads: 1 });
  });

  it('sends a frame and maps the reply to frame fractions with its capture time', async () => {
    const { worker, detector: edge } = detector(fakeRunner());
    await edge.load();
    const frame = await edge.detect(video);
    expect(worker.sent[1]).toMatchObject({ kind: 'detect', id: 1 });
    expect(frame).toEqual({
      detections: [{ label: 'waste_pile', score: 0.62, box: { left: 0, top: 0.5, width: 1, height: 0.5 } }],
      capturedAtMs: 5_000,
      inferenceMs: 0,
    });
  });

  it('answers a frame sent before the model loaded with null and closes the bitmap', async () => {
    const { detector: edge } = detector(fakeRunner());
    await expect(edge.detect(video)).resolves.toBeNull();
  });

  it('rejects load when the model cannot load', async () => {
    const runner = { ...fakeRunner(), load: vi.fn(async () => Promise.reject(new Error('no wasm'))) };
    await expect(detector(runner).detector.load()).rejects.toThrow('no wasm');
  });
});

const PHONE: DeviceCapabilities = { ...CapabilityProbe.NONE, wasmSimd: true, worker: true, offscreenCanvas: true, imageBitmap: true };

function hints(capabilities: DeviceCapabilities, runner: ModelRunner, store = new MemoryStore()) {
  const factory = vi.fn(() => detector(runner).detector);
  return { factory, edge: new EdgeHints(new CapabilityProbe(capabilities), new EdgeHintsPreference(store), factory) };
}

describe('EdgeHints decides edge or cloud mode', () => {
  it('never builds a worker when the startup probe fails', async () => {
    const { factory, edge } = hints(CapabilityProbe.NONE, fakeRunner());
    await expect(edge.open()).resolves.toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });

  it('never builds a worker when the setting is off', async () => {
    const store = new MemoryStore();
    new EdgeHintsPreference(store).set(false);
    const { factory, edge } = hints(PHONE, fakeRunner(), store);
    await expect(edge.open()).resolves.toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });

  it('goes live once and reuses the loaded detector', async () => {
    const { factory, edge } = hints(PHONE, fakeRunner());
    const first = await edge.open();
    expect(first?.warmMs).toBe(40);
    expect(await edge.open()).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('drops to cloud mode for the session when the warm-up is too slow', async () => {
    const { edge } = hints(PHONE, fakeRunner([400, 220]));
    await expect(edge.open()).resolves.toBeNull();
    expect(edge.verdict()).toEqual({ ok: false, reason: 'too_slow' });
    expect(edge.supported()).toBe(false);
  });
});
