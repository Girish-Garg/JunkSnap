import { createPortal } from 'react-dom';
import './photo-viewer.css';
import { PhotoViewerDialog } from './PhotoViewerDialog';
import type { PhotoViewerControl } from './usePhotoViewer';

interface PhotoViewerProps {
  readonly viewer: PhotoViewerControl;
}

/** Full-screen viewer for blurred public copies. Rendered into <body> so it covers sheets and the map. */
export function PhotoViewer({ viewer }: PhotoViewerProps) {
  if (viewer.state === null) return null;
  return createPortal(<PhotoViewerDialog state={viewer.state} viewer={viewer} />, document.body);
}
