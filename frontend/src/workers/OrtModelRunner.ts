import * as ort from 'onnxruntime-web/wasm';
// Served from the app's own origin (and the Android bundle), never a CDN.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { EDGE_MODEL } from '../domain/EdgeModel';
import { EdgeOutput } from '../domain/EdgeOutput';
import { Letterbox } from '../domain/Letterbox';
import type { ModelRunner } from './EdgeWorkerHost';

const SIZE = EDGE_MODEL.inputSize;
const PAD_GREY = 'rgb(114, 114, 114)';

/** onnxruntime-web on WASM (SIMD, threads when the page is cross-origin isolated) inside the worker. */
export class OrtModelRunner implements ModelRunner {
  readonly #canvas = new OffscreenCanvas(SIZE, SIZE);
  readonly #context = this.#canvas.getContext('2d', { willReadFrequently: true });
  #session: ort.InferenceSession | null = null;

  async load(modelUrl: string, threads: number): Promise<string> {
    ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href };
    ort.env.wasm.numThreads = threads;
    ort.env.wasm.proxy = false;
    this.#session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    return `wasm x${threads}`;
  }

  async warmUp(): Promise<number> {
    const started = performance.now();
    await this.#run(new Float32Array(3 * SIZE * SIZE).fill(114 / 255));
    return Math.round(performance.now() - started);
  }

  async detect(bitmap: ImageBitmap): Promise<readonly number[]> {
    let pixels: Float32Array;
    try {
      pixels = this.#pixels(bitmap);
    } finally {
      bitmap.close();
    }
    return EdgeOutput.keep(await this.#run(pixels), EDGE_MODEL.minScore);
  }

  async #run(pixels: Float32Array): Promise<Float32Array> {
    if (!this.#session) throw new Error('model not loaded');
    const input = new ort.Tensor('float32', pixels, [1, 3, SIZE, SIZE]);
    const output = await this.#session.run({ [this.#session.inputNames[0] ?? 'images']: input });
    const first = output[this.#session.outputNames[0] ?? 'output0'];
    return first?.data as Float32Array;
  }

  // Letterbox onto grey, then RGBA bytes to planar RGB floats in 0..1 (CHW).
  #pixels(bitmap: ImageBitmap): Float32Array {
    const context = this.#context;
    if (!context) throw new Error('no 2d context in worker');
    const box = Letterbox.fit(bitmap.width, bitmap.height, SIZE);
    context.fillStyle = PAD_GREY;
    context.fillRect(0, 0, SIZE, SIZE);
    context.drawImage(bitmap, box.padX, box.padY, box.scaledWidth, box.scaledHeight);
    const rgba = context.getImageData(0, 0, SIZE, SIZE).data;
    const plane = SIZE * SIZE;
    const chw = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i += 1) {
      chw[i] = (rgba[i * 4] ?? 0) / 255;
      chw[plane + i] = (rgba[i * 4 + 1] ?? 0) / 255;
      chw[2 * plane + i] = (rgba[i * 4 + 2] ?? 0) / 255;
    }
    return chw;
  }
}
