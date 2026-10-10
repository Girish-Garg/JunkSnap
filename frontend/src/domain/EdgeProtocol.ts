// Messages between EdgeDetector (page) and the edge worker. Frames travel as transferred ImageBitmaps.

export interface LoadRequest {
  readonly kind: 'load';
  readonly modelUrl: string;
  readonly threads: number;
}

export interface DetectRequest {
  readonly kind: 'detect';
  readonly id: number;
  /** Already scaled so its long side is the model input size. */
  readonly bitmap: ImageBitmap;
}

export type EdgeRequest = LoadRequest | DetectRequest;

export interface ReadyReply {
  readonly kind: 'ready';
  /** The second warm-up run on a blank frame, in ms. */
  readonly warmMs: number;
  readonly backend: string;
}

export interface ResultReply {
  readonly kind: 'result';
  readonly id: number;
  /** Rows at or above the model's minScore: x1, y1, x2, y2, score, class in model input pixels. */
  readonly rows: readonly number[];
  readonly inferenceMs: number;
}

export interface FailedReply {
  readonly kind: 'failed';
  readonly id?: number;
  readonly reason: string;
}

export type EdgeReply = ReadyReply | ResultReply | FailedReply;
