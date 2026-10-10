import { BADGE_GLYPHS, INLINE_GLYPHS, type BadgeKind, type Glyph, type InlineGlyph } from './BadgeIcons';

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

interface Palette {
  readonly fill: Rgb;
  readonly border: Rgb;
  readonly glyph: Rgb;
}

// From src/ui/tokens.css (MapLibre images need the values in JS). Light: --surface, --divider,
// --text-secondary. Dark: --tile, --divider, --text-secondary of the dark theme.
export const BADGE_PALETTES: Readonly<Record<'light' | 'dark', Palette>> = {
  light: { fill: [255, 253, 248], border: [235, 224, 207], glyph: [95, 84, 70] },
  dark: { fill: [42, 37, 30], border: [54, 47, 39], glyph: [201, 189, 170] },
};
const RATIO = 2;
const RADIUS = 8 * RATIO;
const PAD = 6 * RATIO;
const GLYPH_SIZE = 24;
const GLYPH_LEFT = 10;

interface Frame {
  readonly width: number;
  readonly height: number;
  readonly glyph: Glyph | null;
  readonly palette: Palette;
}

/** A glyph alone on a clear ground, for an image inside a marker's text. */
export interface GlyphImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly options: { readonly pixelRatio: number };
}

/** Draws badges pixel by pixel: no canvas needed, so it also works in tests and workers. */
export class BadgeArt {
  /** The count or pilot glyph in the badge glyph colour, 12 px on screen, for MapLibre's inline text images. */
  static inline(kind: InlineGlyph, dark = false): GlyphImage {
    const glyph = INLINE_GLYPHS[kind];
    const [r, g, b] = BADGE_PALETTES[dark ? 'dark' : 'light'].glyph;
    const data = new Uint8Array(GLYPH_SIZE * GLYPH_SIZE * 4);
    for (let i = 0; i < GLYPH_SIZE * GLYPH_SIZE; i++) {
      if (glyph(i % GLYPH_SIZE, Math.floor(i / GLYPH_SIZE))) data.set([r, g, b, 255], i * 4);
    }
    return { width: GLYPH_SIZE, height: GLYPH_SIZE, data, options: { pixelRatio: RATIO } };
  }

  /** A plain badge, or one with a fixed glyph at its left that the text never covers or stretches. */
  static create(kind: BadgeKind = 'plain', dark = false): BadgeImage {
    const glyph = BADGE_GLYPHS[kind];
    const palette = BADGE_PALETTES[dark ? 'dark' : 'light'];
    const frame: Frame = glyph
      ? { width: GLYPH_LEFT + GLYPH_SIZE + 2 * RADIUS, height: GLYPH_SIZE + 2 * RADIUS + 8, glyph, palette }
      : { width: 2 * RADIUS + 4, height: 2 * RADIUS + 4, glyph: null, palette };
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
    const { fill, border, glyph } = frame.palette;
    const color = onGlyph ? glyph : d > -RATIO ? border : fill;
    data.set([color[0], color[1], color[2], Math.round(alpha * 255)], (y * frame.width + x) * 4);
  }
}
