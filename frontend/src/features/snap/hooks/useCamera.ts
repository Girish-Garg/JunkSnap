import { useEffect, useState, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import { CaptureError, type CaptureProblem } from '../../../domain/CaptureError';
import { CameraCapture } from '../../../services/CameraCapture';

export type CameraState = 'starting' | 'live' | CaptureProblem;

/** Streams the rear camera into the video element while mounted. */
export function useCamera(video: RefObject<HTMLVideoElement | null>): CameraState {
  const { snap } = useServices();
  const supported = snap.camera.isSupported();
  const [state, setState] = useState<CameraState>(supported ? 'starting' : 'insecure');
  useEffect(() => {
    if (!supported) return undefined;
    let stream: MediaStream | null = null;
    let stopped = false;
    const attach = (opened: MediaStream) => {
      if (stopped) return CameraCapture.close(opened);
      stream = opened;
      if (video.current) video.current.srcObject = opened;
      void video.current?.play().catch(() => undefined);
      setState('live');
    };
    const fail = (error: unknown) => setState(error instanceof CaptureError ? error.problem : 'camera_unavailable');
    snap.camera.open().then(attach, fail);
    return () => {
      stopped = true;
      if (stream) CameraCapture.close(stream);
    };
  }, [snap.camera, supported, video]);
  return state;
}
