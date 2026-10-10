// The on-phone detector in public/models/ (S3 models/edge_int8/, backend/ml/src/ml/settings/models.json).
// Ultralytics YOLO26n, AGPL-3.0. Its boxes are hints for live boxes and frame choice; the server re-verifies.

/** Class names in model output order; public/models/edge-int8.classes.json holds the same list. */
export const EDGE_CLASSES = ['waste_pile', 'bag', 'bin', 'burning', 'waste_item'] as const;

export type EdgeClass = (typeof EDGE_CLASSES)[number];

/** The classes that mean "there is waste here". A bin alone is not waste. */
export const WASTE_CLASSES: ReadonlySet<EdgeClass> = new Set<EdgeClass>(['waste_pile', 'bag', 'waste_item', 'burning']);

export const EDGE_MODEL = {
  path: 'models/edge-int8.onnx',
  version: 'yolo26n-320-int8-v1',
  sha256: 'fa07920d9552faf7e8498499b048e8d5c7ed9c650ea93c4f5d07e72f156b0312',
  inputSize: 320,
  /** The worker drops rows below this; the overlay and scan hints use their own, higher bars. */
  minScore: 0.25,
} as const;

/** The model's path stamped with its hash, so a phone never runs an old model from its HTTP cache after a deploy. */
export const EDGE_MODEL_URL_PATH = `${EDGE_MODEL.path}?v=${EDGE_MODEL.sha256.slice(0, 16)}`;

/** A box as fractions of the frame's width and height (the scan_session hints box shape). */
export interface BoxFraction {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Detection {
  readonly label: EdgeClass;
  readonly score: number;
  readonly box: BoxFraction;
}

/** One analysed frame: what was found, when the frame was grabbed and how long the model took. */
export interface FrameDetections {
  readonly detections: readonly Detection[];
  readonly capturedAtMs: number;
  readonly inferenceMs: number;
}
