import { describe, expect, it } from 'vitest';
import { AreaMarkers } from '../src/features/map/AreaMarkers';
import { AreaMarkerSource } from '../src/features/map/AreaMarkerSource';
import { BADGE_PALETTES, BadgeArt } from '../src/features/map/BadgeArt';
import { BADGE_GLYPHS } from '../src/features/map/BadgeIcons';
import { MarkerTooltip } from '../src/features/map/MarkerTooltip';
import type { LabelPoints } from '../src/services/BoundaryCatalog';
import { areaRow } from './areaRows';

const texts = {
  number: (n: number) => String(n),
  score: (name: string, n: string) => `${name}: score ${n}`,
  reports: (name: string, _count: number, n: string) => `${name}: ${n} reports`,
  noReports: (name: string) => `${name}: none`,
};

describe('AreaMarkers', () => {
  it('shows a bare number by the shown score, else by verified reports, with the words in the tooltip', () => {
    const markers = AreaMarkers.of(
      [
        areaRow({ id: 'a', name: 'A', reports: 14, scores: { city: 41, citizen: 58, bin_access: 32 } }),
        areaRow({ id: 'b', name: 'B', reports: 4 }),
        areaRow({ id: 'c', name: 'C', reports: 0 }),
      ],
      texts,
    );
    expect(markers.get('a')).toMatchObject({ value: '44', basis: 'score', tooltip: 'A: score 44' });
    expect(markers.get('b')).toMatchObject({ value: '4', basis: 'count', tooltip: 'B: 4 reports' });
    expect(markers.get('c')).toMatchObject({ value: null, basis: null, tooltip: 'C: none' });
  });

  it('never shows a withheld score, even when the row carries a value', () => {
    const markers = AreaMarkers.of([areaRow({ id: 'a', reports: 9, scores: { city: 12 } })], texts);
    expect(markers.get('a')).toMatchObject({ value: '9', basis: 'count' });
  });
});

describe('AreaMarkers collision order', () => {
  it('ranks the worst score first for collisions, then the most reports', () => {
    const markers = AreaMarkers.of(
      [
        areaRow({ id: 'few', reports: 2 }),
        areaRow({ id: 'good', reports: 20, scores: { city: 80 } }),
        areaRow({ id: 'many', reports: 8 }),
        areaRow({ id: 'bad', reports: 11, scores: { city: 20 } }),
      ],
      texts,
    );
    const order = [...markers.entries()].sort(([, a], [, b]) => a.rank - b.rank).map(([id]) => id);
    expect(order).toEqual(['bad', 'good', 'many', 'few']);
  });
});

describe('AreaMarkerSource.merge', () => {
  const points: LabelPoints = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { id: 'a', name: 'A', kind: 'assembly' }, geometry: { type: 'Point', coordinates: [73, 26] } },
      { type: 'Feature', properties: { id: 'b', name: 'B', kind: 'loksabha' }, geometry: { type: 'Point', coordinates: [74, 27] } },
    ],
  };

  it('puts each value, basis, tooltip and rank flat on the marker point', () => {
    const marker = { value: '44', basis: 'score', tooltip: 'A: score 44', rank: 0 } as const;
    const merged = AreaMarkerSource.merge(points, new Map([['a', marker]]));
    expect(merged.features.map((f) => f.properties)).toEqual([
      { id: 'a', name: 'A', kind: 'assembly', marker_value: '44', marker_basis: 'score', marker_tooltip: 'A: score 44', marker_rank: 0 },
      { id: 'b', name: 'B', kind: 'loksabha', marker_rank: 9999 },
    ]);
    expect(MarkerTooltip.text(merged.features[0]?.properties ?? undefined)).toBe('A: score 44');
    expect(MarkerTooltip.text(merged.features[1]?.properties ?? undefined)).toBeNull();
  });

  it('is empty until the points have loaded', () => {
    expect(AreaMarkerSource.merge(null, new Map()).features).toEqual([]);
  });
});

describe('BadgeArt', () => {
  const alpha = (badge: ReturnType<typeof BadgeArt.create>, x: number, y: number) => badge.data[(y * badge.width + x) * 4 + 3];

  it('is an opaque rounded badge whose middle stretches around the text', () => {
    const badge = BadgeArt.create();
    const mid = Math.floor(badge.width / 2);
    expect([alpha(badge, 0, 0), alpha(badge, mid, mid)]).toEqual([0, 255]);
    const [[from, to]] = badge.options.stretchX as [[number, number]];
    expect([from < mid, to > mid]).toEqual([true, true]);
  });

});

describe('BadgeArt glyphs', () => {
  it('draws the score and photo glyphs at the left, outside every stretch zone and the text box', () => {
    for (const kind of ['score', 'count'] as const) {
      const badge = BadgeArt.create(kind);
      const [[stretchFrom]] = badge.options.stretchX as [[number, number]];
      const [, [lowerFrom]] = badge.options.stretchY as [[number, number], [number, number]];
      const [upper] = badge.options.stretchY as [[number, number]];
      expect(stretchFrom).toBeGreaterThanOrEqual(34);
      expect(badge.options.content[0]).toBeGreaterThanOrEqual(34);
      expect(lowerFrom - upper[1]).toBe(24);
      // Every glyph pixel is drawn in the secondary text colour, fully opaque.
      const cells = [...Array(24 * 24).keys()].map((i) => [i % 24, Math.floor(i / 24)] as const);
      const drawn = cells.filter(([dx, dy]) => BADGE_GLYPHS[kind]?.(dx, dy));
      expect(drawn.length).toBeGreaterThan(100);
      for (const [dx, dy] of drawn) {
        const i = ((upper[1] + dy) * badge.width + 10 + dx) * 4;
        expect([...badge.data.slice(i, i + 4)]).toEqual([...BADGE_PALETTES.light.glyph, 255]);
      }
    }
  });
});

describe('BadgeArt dark theme', () => {
  const pixel = (badge: ReturnType<typeof BadgeArt.create>, x: number, y: number) => {
    const i = (y * badge.width + x) * 4;
    return [...badge.data.slice(i, i + 4)];
  };

  it('draws a dark tile with light glyphs, same size and stretch zones as the light badge', () => {
    for (const kind of ['plain', 'score', 'count'] as const) {
      const light = BadgeArt.create(kind);
      const dark = BadgeArt.create(kind, true);
      expect([dark.width, dark.height, dark.options]).toEqual([light.width, light.height, light.options]);
      const right = dark.width - 18;
      const middle = Math.floor(dark.height / 2);
      expect(pixel(dark, right, middle)).toEqual([...BADGE_PALETTES.dark.fill, 255]);
      expect(pixel(light, right, middle)).toEqual([...BADGE_PALETTES.light.fill, 255]);
    }
    const score = BadgeArt.create('score', true);
    const top = (score.height - 24) / 2;
    // Bar 3 of the score glyph covers x 16-21 at the glyph's row 20.
    expect(pixel(score, 10 + 18, top + 20)).toEqual([...BADGE_PALETTES.dark.glyph, 255]);
  });
});
