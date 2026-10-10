import { EDGE_MODEL, type FrameDetections } from '../domain/EdgeModel';
import { EdgeOutput } from '../domain/EdgeOutput';
import type { EdgeReply, EdgeRequest, ReadyReply } from '../domain/EdgeProtocol';
import { Letterbox } from '../domain/Letterbox';

/** The part of Worker the detector uses, so tests can stand in for it. */
export interface WorkerLike {
  onmessage: ((event: MessageEvent<EdgeReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: EdgeRequest, transfer: Transferable[]): void;
  terminate(): void;
}

/** A video frame scaled for the model, plus the frame's own size for mapping boxes back. */
export interface GrabbedFrame {
  readonly bitmap: ImageBitmap;
  readonly width: number;
  readonly height: number;
}

export interface FrameGrabber {
  grab(video: HTMLVideoElement, letterboxSize: number): Promise<GrabbedFrame | null>;
}

export interface EdgeDetectorPorts {
  readonly worker: WorkerLike;
  readonly grabber: FrameGrabber;
  readonly modelUrl: string;
  readonly threads: number;
  readonly now: () => number;
}

interface Pending {
  readonly resolve: (reply: EdgeReply) => void;
}

/** Page side of the edge worker: loads the model once, then sends one frame at a time. */
export class EdgeDetector {
  readonly #ports: EdgeDetectorPorts;
  readonly #pending = new Map<number, Pending>();
  #nextId = 1;

  constructor(ports: EdgeDetectorPorts) {
    this.#ports = ports;
    ports.worker.onmessage = (event) => this.#reply(event.data);
    ports.worker.onerror = (event) => this.#reply({ kind: 'failed', reason: event.message || 'worker error' });
  }

  /** Loads onnxruntime and the model in the worker and runs the warm-up; rejects when either fails. */
  async load(): Promise<ReadyReply> {
    const reply = await this.#send(0, { kind: 'load', modelUrl: this.#ports.modelUrl, threads: this.#ports.threads }, []);
    if (reply.kind !== 'ready') throw new Error(reply.kind === 'failed' ? reply.reason : 'unexpected reply');
    return reply;
  }

  /** Detections for the current frame, or null when no frame was ready or the model failed. */
  async detect(video: HTMLVideoElement): Promise<FrameDetections | null> {
    const capturedAtMs = this.#ports.now();
    const frame = await this.#ports.grabber.grab(video, EDGE_MODEL.inputSize);
    if (!frame) return null;
    const id = this.#nextId++;
    const reply = await this.#send(id, { kind: 'detect', id, bitmap: frame.bitmap }, [frame.bitmap]);
    if (reply.kind !== 'result') return null;
    const letterbox = Letterbox.fit(frame.width, frame.height, EDGE_MODEL.inputSize);
    return { detections: EdgeOutput.decode(reply.rows, letterbox, EDGE_MODEL.minScore), capturedAtMs, inferenceMs: reply.inferenceMs };
  }

  dispose(): void {
    this.#ports.worker.terminate();
    for (const pending of this.#pending.values()) pending.resolve({ kind: 'failed', reason: 'disposed' });
    this.#pending.clear();
  }

  #send(id: number, message: EdgeRequest, transfer: Transferable[]): Promise<EdgeReply> {
    return new Promise((resolve) => {
      this.#pending.set(id, { resolve });
      this.#ports.worker.postMessage(message, transfer);
    });
  }

  // Load replies carry no id (0); a failure without an id ends everything waiting.
  #reply(reply: EdgeReply): void {
    const id = reply.kind === 'result' ? reply.id : reply.kind === 'failed' ? reply.id : 0;
    if (id === undefined) return this.#failAll(reply);
    this.#pending.get(id)?.resolve(reply);
    this.#pending.delete(id);
  }

  #failAll(reply: EdgeReply): void {
    for (const pending of this.#pending.values()) pending.resolve(reply);
    this.#pending.clear();
  }
}
