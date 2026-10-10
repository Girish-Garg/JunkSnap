import { useEffect, useState, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import type { CameraUse } from '../../../services/CameraCapture';
import { FrameCounter } from '../../../services/FrameCounter';
import { LiveCamera, type CameraEvent, type CameraState } from '../../../services/LiveCamera';
import { DocumentVisibility } from '../../../services/PageVisibility';
import { WINDOW_TIMER } from '../../../services/Timer';

export type { CameraState };

// Field reports: a restart shows in the WebView console (chrome://inspect) with its reason.
const logEvent = (event: CameraEvent, restarts: number) => console.info(`[camera] ${event}, restart ${restarts}`);

/** Streams the rear camera into the video element while mounted and keeps it live; retry asks for the camera again. */
export function useCamera(video: RefObject<HTMLVideoElement | null>, use: CameraUse = 'photo') {
  const { snap } = useServices();
  const supported = snap.camera.isSupported();
  const [state, setState] = useState<CameraState>(supported ? 'starting' : 'insecure');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const screen = video.current;
    if (!supported || !screen) return undefined;
    const ports = { open: () => snap.camera.open(use), page: new DocumentVisibility(document), timer: WINDOW_TIMER, now: () => performance.now() };
    const camera = new LiveCamera(ports, { screen, frames: FrameCounter.for(screen), onState: setState, onEvent: logEvent });
    camera.start();
    return () => camera.stop();
  }, [snap.camera, supported, video, attempt, use]);
  const retry = () => {
    setState(supported ? 'starting' : 'insecure');
    setAttempt((count) => count + 1);
  };
  return { state, retry };
}
