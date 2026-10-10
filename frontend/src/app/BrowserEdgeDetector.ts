import { EDGE_MODEL_URL_PATH } from '../domain/EdgeModel';
import { BitmapFrameGrabber } from '../services/BitmapFrameGrabber';
import { EdgeDetector, type WorkerLike } from '../services/EdgeDetector';
import type { DetectorFactory } from '../services/EdgeHints';

/**
 * The real detector: a module worker that Vite bundles separately with onnxruntime-web, so neither
 * the runtime nor the model is part of first paint; they load when the camera first opens.
 */
export const browserDetectorFactory: DetectorFactory = (threads) =>
  new EdgeDetector({
    worker: new Worker(new URL('../workers/edge.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
    grabber: new BitmapFrameGrabber((video, options) => createImageBitmap(video, options)),
    modelUrl: new URL(`${import.meta.env.BASE_URL}${EDGE_MODEL_URL_PATH}`, window.location.href).href,
    threads,
    now: () => Date.now(),
  });
