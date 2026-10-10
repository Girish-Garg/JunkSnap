import type { CSSProperties } from 'react';
import type { GestureOutcome } from './PhotoGesture';
import { usePhotoGestures } from './usePhotoGestures';
import type { ViewerPhoto } from './ViewerPhoto';

interface PhotoViewerStageProps {
  readonly photo: ViewerPhoto;
  readonly onOutcome: (outcome: GestureOutcome) => void;
}

/** The photo itself: follows the finger or mouse, pinches and double-taps to zoom. */
export function PhotoViewerStage({ photo, onOutcome }: PhotoViewerStageProps) {
  const { transform, dragging, handlers } = usePhotoGestures(onOutcome);
  const { scale, pan, drag } = transform;
  const style: CSSProperties = {
    transform: `translate(${pan.x + drag.x}px, ${pan.y + drag.y}px) scale(${scale})`,
    opacity: drag.y > 0 ? Math.max(0.4, 1 - drag.y / 400) : 1,
  };
  return (
    <div className={`photo-viewer__stage${dragging ? ' photo-viewer__stage--dragging' : ''}`} data-testid="photo-stage" data-own-drag="" {...handlers}>
      <img key={photo.url} className="photo-viewer__image" src={photo.url} alt={photo.alt} style={style} draggable={false} decoding="async" />
    </div>
  );
}
