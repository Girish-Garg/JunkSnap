import { useState, type PointerEvent } from 'react';
import { PhotoGesture, type GestureOutcome, type PhotoTransform } from './PhotoGesture';

type Handler = (event: PointerEvent<HTMLElement>) => void;

export interface PhotoGestureBinding {
  readonly transform: PhotoTransform;
  readonly dragging: boolean;
  readonly handlers: {
    readonly onPointerDown: Handler;
    readonly onPointerMove: Handler;
    readonly onPointerUp: Handler;
    readonly onPointerCancel: Handler;
  };
}

const at = (event: PointerEvent<HTMLElement>) => ({ x: event.clientX, y: event.clientY });

/** Adapts PhotoGesture to pointer events. The stage is keyed by photo, so each photo starts unzoomed. */
export function usePhotoGestures(onOutcome: (outcome: GestureOutcome) => void): PhotoGestureBinding {
  const [gesture] = useState(() => new PhotoGesture());
  const [transform, setTransform] = useState(gesture.view());
  const [dragging, setDragging] = useState(false);

  const sync = (active: boolean) => {
    setTransform(gesture.view());
    setDragging(active);
  };
  const onPointerDown: Handler = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.down(event.pointerId, at(event), event.timeStamp);
    sync(true);
  };
  const onPointerMove: Handler = (event) => {
    gesture.move(event.pointerId, at(event));
    setTransform(gesture.view());
  };
  const onPointerUp: Handler = (event) => {
    const outcome = gesture.up(event.pointerId, at(event), event.timeStamp);
    sync(false);
    if (outcome !== 'none') onOutcome(outcome);
  };
  const onPointerCancel: Handler = (event) => {
    gesture.cancel(event.pointerId);
    sync(false);
  };
  return { transform, dragging, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
