import { BADGE_GLYPHS, type BadgeKind, type Glyph } from './BadgeIcons';

/** A stretchable rounded badge for MapLibre's icon-text-fit; the text sits inside `content`. */
export interface BadgeImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly options: {
    readonly pixelRatio: number;
    readonly stretchX: [number, number][];
    readonly stretchY: [number, number][];
    readonly content: [number, number, number, number];
  };
}

type Rgb = readonly [number, number, number];

// Same as --surface, --divider and --text-secondary in theme.css; MapLibre images need the values in JS.
const FILL: Rgb = [255, 255, 255];
const BORDER: Rgb = [218, 220, 224];
const GLYPH: Rgb = [95, 99, 104];
const RATIO = 2;
const RADIUS = 8 * RATIO;
const PAD = 6 * RATIO;
const GLYPH_SIZE = 24;
const GLYPH_LEFT = 10;

interface Frame {
  readonly width: number;
  readonly height: number;
  readonly glyph: Glyph | null;
}

/** Draws badges pixel by pixel: no canvas needed, so it also works in tests and workers. */
export class BadgeArt {
  /** A plain badge, or one with a fixed glyph at its left that the text never covers or stretches. */
  static create(kind: BadgeKind = 'plain'): BadgeImage {
    const glyph = BADGE_GLYPHS[kind];
    const frame: Frame = glyph
      ? { width: GLYPH_LEFT + GLYPH_SIZE + 2 * RADIUS, height: GLYPH_SIZE + 2 * RADIUS + 8, glyph }
      : { width: 2 * RADIUS + 4, height: 2 * RADIUS + 4, glyph: null };
    const data = new Uint8Array(frame.width * frame.height * 4);
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) BadgeArt.#paint(data, frame, x, y);
    }
    return { width: frame.width, height: frame.height, data, options: BadgeArt.#options(frame) };
  }

  /** Signed distance from the rounded rectangle's edge; negative inside. */
  static distance(width: number, height: number, x: number, y: number): number {
    const dx = Math.max(Math.abs(x + 0.5 - width / 2) - (width / 2 - RADIUS - 0.5), 0);
    const dy = Math.max(Math.abs(y + 0.5 - height / 2) - (height / 2 - RADIUS - 0.5), 0);
    return Math.hypot(dx, dy) - RADIUS;
  }

  // The glyph keeps its size: stretching happens only right of it and above and below its rows.
  static #options({ width, height, glyph }: Frame): BadgeImage['options'] {
    if (!glyph) {
      return {
        pixelRatio: RATIO,
        stretchX: [[RADIUS, width - RADIUS]],
        stretchY: [[RADIUS, height - RADIUS]],
        content: [PAD, PAD / 2, width - PAD, height - PAD / 2],
      };
    }
    const top = (height - GLYPH_SIZE) / 2;
    // Stretch starts where the text starts, so the gap between glyph and text never grows.
    const textLeft = GLYPH_LEFT + GLYPH_SIZE + 6;
    return {
      pixelRatio: RATIO,
      stretchX: [[textLeft, width - RADIUS]],
      stretchY: [[RADIUS, top], [top + GLYPH_SIZE, height - RADIUS]],
      content: [textLeft, PAD / 2, width - PAD, height - PAD / 2],
    };
  }

  static #paint(data: Uint8Array, frame: Frame, x: number, y: number): void {
    const d = BadgeArt.distance(frame.width, frame.height, x, y);
    const alpha = Math.min(Math.max(0.5 - d, 0), 1);
    const top = (frame.height - GLYPH_SIZE) / 2;
    const onGlyph = frame.glyph?.(x - GLYPH_LEFT, y - top) ?? false;
    const color = onGlyph ? GLYPH : d > -RATIO ? BORDER : FILL;
    data.set([color[0], color[1], color[2], Math.round(alpha * 255)], (y * frame.width + x) * 4);
  }
}
