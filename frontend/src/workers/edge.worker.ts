// Entry of the edge worker: onnxruntime-web and the model load here, off the main thread,
// and only when the camera opens (EdgeDetector creates this worker lazily).
import type { EdgeReply, EdgeRequest } from '../domain/EdgeProtocol';
import { EdgeWorkerHost } from './EdgeWorkerHost';
import { OrtModelRunner } from './OrtModelRunner';

interface WorkerScope {
  onmessage: ((event: MessageEvent<EdgeRequest>) => void) | null;
  postMessage(reply: EdgeReply): void;
}

const scope = self as unknown as WorkerScope;
const host = new EdgeWorkerHost(new OrtModelRunner(), (reply) => scope.postMessage(reply), () => performance.now());

scope.onmessage = (event) => void host.handle(event.data);
