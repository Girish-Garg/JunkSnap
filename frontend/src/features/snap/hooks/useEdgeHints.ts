import { useEffect, useRef, useState, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import type { FrameDetections } from '../../../domain/EdgeModel';
import type { EdgeHints, EdgeReady } from '../../../services/EdgeHints';
import { EdgeHintLoop } from '../../../services/EdgeHintLoop';
import { FrameCounter } from '../../../services/FrameCounter';
import { DocumentVisibility } from '../../../services/PageVisibility';
import { WINDOW_TIMER } from '../../../services/Timer';
import { EdgeOverlayView, EMPTY_OVERLAY, type OverlayView } from '../EdgeOverlayView';
import { useEdgeHintsSetting } from './useEdgeHintsSetting';

export type EdgeState = 'off' | 'loading' | 'live';

interface Run {
  readonly edge: EdgeHints;
  readonly video: RefObject<HTMLVideoElement | null>;
  readonly onReady: (ready: EdgeReady | null) => void;
  readonly onFrame: (frame: FrameDetections) => void;
}

// Loads the detector (first time only) and runs the loop on new frames of a visible page; the returned function stops it.
function runHints({ edge, video, onReady, onFrame }: Run): () => void {
  let loop: EdgeHintLoop | null = null;
  let cancelled = false;
  const counter = video.current ? FrameCounter.for(video.current) : null;
  const page = new DocumentVisibility(document);
  const frames = counter ? () => counter.count : undefined;
  counter?.start();
  void edge.open().then((loaded) => {
    if (cancelled) return;
    onReady(loaded);
    if (loaded) loop = new EdgeHintLoop({ detector: loaded.detector, video: () => video.current, onFrame, timer: WINDOW_TIMER, frames, visible: () => page.visible() });
    loop?.start();
  });
  return () => {
    cancelled = true;
    counter?.stop();
    loop?.stop();
  };
}

function edgeState(active: boolean, ready: EdgeReady | null | undefined): EdgeState {
  if (!active || ready === null) return 'off';
  return ready === undefined ? 'loading' : 'live';
}

function overlayFor(frame: FrameDetections, element: HTMLVideoElement): OverlayView {
  return EdgeOverlayView.from(frame, { width: element.videoWidth, height: element.videoHeight }, { width: element.clientWidth, height: element.clientHeight });
}

/**
 * Live on-phone boxes over the viewfinder while the camera is live, in edge mode only. The model
 * loads the first time this runs. onFrame also gets every analysed frame (Scan keeps them as hints).
 */
export function useEdgeHints(video: RefObject<HTMLVideoElement | null>, live: boolean, onFrame?: (frame: FrameDetections) => void) {
  const { edge } = useServices();
  const setting = useEdgeHintsSetting();
  const active = live && setting.supported && setting.on;
  const [ready, setReady] = useState<EdgeReady | null | undefined>(undefined);
  const [view, setView] = useState<OverlayView>(EMPTY_OVERLAY);
  const listener = useRef(onFrame);
  useEffect(() => {
    listener.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    if (!active) return undefined;
    const show = (frame: FrameDetections) => {
      if (video.current) setView(overlayFor(frame, video.current));
      listener.current?.(frame);
    };
    const stop = runHints({ edge, video, onReady: setReady, onFrame: show });
    return () => {
      stop();
      setView(EMPTY_OVERLAY); // no stale boxes when the camera comes back
    };
  }, [active, edge, video]);
  const state = edgeState(active, ready);
  return { state, view: state === 'live' ? view : EMPTY_OVERLAY, warmMs: ready?.warmMs ?? null };
}
