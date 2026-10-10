import { CoverFit, type ScreenBox } from '../../domain/CoverFit';
import { WASTE_CLASSES, type EdgeClass, type FrameDetections } from '../../domain/EdgeModel';

/** Boxes below this are not drawn; the live view should not flicker with guesses (0.35 boxed plain walls). */
export const OVERLAY_MIN_SCORE = 0.5;
/** At most this many boxes, strongest first, so the viewfinder stays readable. */
const MAX_BOXES = 8;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface OverlayBox {
  readonly key: string;
  readonly label: EdgeClass;
  /** Whole percent, for the label. */
  readonly percent: number;
  readonly screen: ScreenBox;
}

export interface OverlayView {
  readonly boxes: readonly OverlayBox[];
  /** True when a waste box is on screen; the hint says "Waste spotted" only after SPOTTED_FRAMES such frames in a row. */
  readonly spotted: boolean;
  /** How long the model took on this frame, for the data attribute measurements read. */
  readonly inferenceMs: number | null;
}

export const EMPTY_OVERLAY: OverlayView = { boxes: [], spotted: false, inferenceMs: null };

/** Places one frame's detections over a viewfinder shown with object-fit: cover. Decides nothing. */
export class EdgeOverlayView {
  static from(frame: FrameDetections, video: Size, element: Size): OverlayView {
    if (video.width === 0 || element.width === 0) return EMPTY_OVERLAY;
    const fit = new CoverFit(video, element);
    const boxes: OverlayBox[] = [];
    for (const found of frame.detections) {
      const screen = found.score >= OVERLAY_MIN_SCORE ? fit.place(found.box) : null;
      if (screen && boxes.length < MAX_BOXES) boxes.push({ key: `${boxes.length}`, label: found.label, percent: Math.round(found.score * 100), screen });
    }
    return { boxes, spotted: boxes.some((box) => WASTE_CLASSES.has(box.label)), inferenceMs: frame.inferenceMs };
  }
}
