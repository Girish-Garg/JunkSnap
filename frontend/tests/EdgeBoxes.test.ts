import { describe, expect, it } from 'vitest';
import classNames from '../public/models/edge-int8.classes.json';
import { CoverFit } from '../src/domain/CoverFit';
import { EDGE_CLASSES, type FrameDetections } from '../src/domain/EdgeModel';
import { EdgeOutput } from '../src/domain/EdgeOutput';
import { Letterbox } from '../src/domain/Letterbox';
import { EdgeOverlayView } from '../src/features/snap/EdgeOverlayView';

describe('model output to frame fractions', () => {
  it('letterboxes a 720x960 portrait frame into 320 with grey bars left and right', () => {
    const box = Letterbox.fit(720, 960, 320);
    expect(box).toMatchObject({ scaledWidth: 240, scaledHeight: 320, padX: 40, padY: 0 });
  });

  it('maps a box in model pixels back to the frame, removing the padding', () => {
    const box = Letterbox.fit(720, 960, 320).toFraction(40, 0, 160, 160);
    expect(box).toEqual({ left: 0, top: 0, width: 0.5, height: 0.5 });
  });

  it('decodes [x1, y1, x2, y2, score, class] rows, drops weak or unknown ones, strongest first', () => {
    const rows = [40, 160, 280, 320, 0.5, 0, 100, 0, 200, 100, 0.87, 2, 0, 0, 10, 10, 0.1, 4, 0, 0, 10, 10, 0.9, 9];
    const found = EdgeOutput.decode(rows, Letterbox.fit(720, 960, 320), 0.25);
    expect(found.map((item) => [item.label, item.score])).toEqual([
      ['bin', 0.87],
      ['waste_pile', 0.5],
    ]);
    expect(found[1]?.box).toEqual({ left: 0, top: 0.5, width: 1, height: 0.5 });
  });

  it('keep() flattens only the rows at or above the score', () => {
    expect(EdgeOutput.keep([1, 2, 3, 4, 0.3, 1, 5, 6, 7, 8, 0.2, 0], 0.25)).toEqual([1, 2, 3, 4, 0.3, 1]);
  });

  it('ships class names in the same order as the model metadata', () => {
    expect(classNames).toEqual([...EDGE_CLASSES]);
  });
});

describe('frame fractions to the viewfinder (object-fit: cover)', () => {
  it('crops a 4:3 landscape frame shown in a portrait box at the sides', () => {
    // 1280x960 frame in a 300x400 element: scaled to 533x400, 116.7 px cut off each side.
    const fit = new CoverFit({ width: 1280, height: 960 }, { width: 300, height: 400 });
    expect(fit.place({ left: 0.5, top: 0, width: 0.25, height: 0.5 })).toEqual({ left: 50, top: 0, width: 44.44, height: 50 });
  });

  it('clips boxes at the edge and drops boxes in the cropped part', () => {
    const fit = new CoverFit({ width: 1280, height: 960 }, { width: 300, height: 400 });
    expect(fit.place({ left: 0, top: 0, width: 0.1, height: 1 })).toBeNull();
    expect(fit.place({ left: 0.1, top: 0, width: 0.2, height: 1 })?.left).toBe(0);
  });

  it('matches the frame exactly when the aspect ratios agree', () => {
    const fit = new CoverFit({ width: 720, height: 960 }, { width: 360, height: 480 });
    expect(fit.place({ left: 0.1, top: 0.2, width: 0.3, height: 0.4 })).toEqual({ left: 10, top: 20, width: 30, height: 40 });
  });
});

describe('EdgeOverlayView', () => {
  const frame = (label: (typeof EDGE_CLASSES)[number], score: number): FrameDetections => ({
    detections: [{ label, score, box: { left: 0.1, top: 0.1, width: 0.5, height: 0.5 } }],
    capturedAtMs: 0,
    inferenceMs: 20,
  });
  const size = { width: 720, height: 960 };

  it('says "Waste spotted" for a waste box and not for a bin alone', () => {
    expect(EdgeOverlayView.from(frame('waste_pile', 0.6), size, size)).toMatchObject({ spotted: true, inferenceMs: 20 });
    expect(EdgeOverlayView.from(frame('bin', 0.9), size, size)).toMatchObject({ spotted: false });
  });

  it('does not draw boxes under the overlay score', () => {
    expect(EdgeOverlayView.from(frame('bag', 0.3), size, size).boxes).toEqual([]);
  });

  it('labels boxes with whole percent', () => {
    expect(EdgeOverlayView.from(frame('bag', 0.876), size, size).boxes[0]).toMatchObject({ label: 'bag', percent: 88 });
  });
});
