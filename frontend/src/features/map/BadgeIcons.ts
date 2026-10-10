/** A 24 x 24 device-pixel glyph: true where the icon is drawn. */
export type Glyph = (x: number, y: number) => boolean;

export type BadgeKind = 'plain' | 'score' | 'count';

/** Left, top, right, bottom; right and bottom excluded. */
type Rect = readonly [number, number, number, number];

const inRect = (x: number, y: number, [x0, y0, x1, y1]: Rect) => x >= x0 && x < x1 && y >= y0 && y < y1;

const BARS: readonly Rect[] = [
  [2, 14, 8, 22],
  [9, 8, 15, 22],
  [16, 2, 22, 22],
];
const CAMERA: readonly Rect[] = [
  [1, 7, 23, 21],
  [8, 3, 16, 7],
];

// Three rising bars: a shown score (same idea as the Areas tab icon).
const score: Glyph = (x, y) => BARS.some((bar) => inRect(x, y, bar));

// A camera with a lens: verified photo reports.
const count: Glyph = (x, y) => CAMERA.some((part) => inRect(x, y, part)) && Math.hypot(x + 0.5 - 12, y + 0.5 - 14) >= 4;

// A flag on a pole: pilot-city data (Jodhpur), drawn after a shown score.
const FLAG: readonly Rect[] = [
  [4, 2, 7, 23],
  [7, 3, 20, 13],
];
const pilot: Glyph = (x, y) => FLAG.some((part) => inRect(x, y, part)) && !(x >= 15 && Math.abs(y - 8) < x - 14);

/** The glyph drawn at the left of each badge kind; plain badges have none. */
export const BADGE_GLYPHS: Readonly<Record<BadgeKind, Glyph | null>> = { plain: null, score, count };

/** Glyphs drawn inside a marker's text after a shown score: its verified report count, and the pilot flag. */
export type InlineGlyph = 'count' | 'pilot';

export const INLINE_GLYPHS: Readonly<Record<InlineGlyph, Glyph>> = { count, pilot };
