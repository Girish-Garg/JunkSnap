import { describe, expect, it } from 'vitest';
import areasText from '../public/boundaries/areas.geojson?raw';
import { AreaAdjacency } from '../src/domain/AreaAdjacency';
import { AreaColouring } from '../src/domain/AreaColouring';
import type { AreaPolygons } from '../src/domain/AreaShapes';
import { AREA_TINTS, TINT_COUNT } from '../src/layers/boundaries/AreaTints';
import { BoundaryCatalog } from '../src/services/BoundaryCatalog';

// Vitest hands CSS imports back empty, so the stylesheet is read from disk (the app has no Node types).
type FileReader = { readFileSync(path: string, encoding: 'utf8'): string };
const fs = (await import('node:fs' as string)) as FileReader;
// Tests run from frontend/ (npm test).
const tokensCss = fs.readFileSync('src/ui/tokens.css', 'utf8');

// The file the map draws, as shipped.
const AREAS = JSON.parse(areasText) as AreaPolygons;
const NEIGHBOURS = AreaAdjacency.of(AREAS);
const SLOTS = AreaColouring.of(NEIGHBOURS, TINT_COUNT);

// A small square of side 1 with its lower left corner at (x, y), as one area.
function square(id: string, x: number, y: number): AreaPolygons['features'][number] {
  const ring = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]];
  return { type: 'Feature', properties: { id }, geometry: { type: 'Polygon', coordinates: [ring] } };
}

describe('AreaAdjacency', () => {
  it('links areas that share an edge or a corner, and not areas apart', () => {
    const grid: AreaPolygons = { type: 'FeatureCollection', features: [square('a', 0, 0), square('b', 1, 0), square('c', 1, 1), square('d', 5, 5)] };
    const neighbours = AreaAdjacency.of(grid);
    expect([...(neighbours.get('a') ?? [])].sort()).toEqual(['b', 'c']);
    expect([...(neighbours.get('d') ?? [])]).toEqual([]);
  });

  it('finds the Jodhpur city seat between Sardarpura, Soorsagar and Luni in the shipped areas', () => {
    expect([...(NEIGHBOURS.get('s20-ac-128') ?? [])].sort()).toEqual(['s20-ac-127', 's20-ac-129', 's20-ac-130']);
  });
});

describe('AreaColouring on the real areas.geojson', () => {
  it('colours every area', () => {
    expect(SLOTS.size).toBe(AREAS.features.length);
  });

  it('never gives two neighbours the same colour', () => {
    const clashes = [...NEIGHBOURS].flatMap(([id, others]) => [...others].filter((other) => SLOTS.get(other) === SLOTS.get(id)).map((other) => `${id}/${other}`));
    expect(clashes).toEqual([]);
  });

  it('stays within the palette and spreads it, so no one colour dominates the map', () => {
    const counts = new Array<number>(TINT_COUNT).fill(0);
    for (const slot of SLOTS.values()) counts[slot] = (counts[slot] ?? 0) + 1;
    expect(Math.max(...SLOTS.values())).toBeLessThan(TINT_COUNT);
    expect(Math.min(...counts)).toBeGreaterThan(0);
    expect(Math.max(...counts)).toBeLessThan(AREAS.features.length / 4);
  });

  it('gives the same colours on every load', () => {
    expect(AreaColouring.of(AreaAdjacency.of(AREAS), TINT_COUNT)).toEqual(SLOTS);
  });
});

describe('BoundaryCatalog.areaShapes', () => {
  it('reads and colours the polygons once per index version and shares the result', async () => {
    const grid: AreaPolygons = { type: 'FeatureCollection', features: [square('a', 0, 0), square('b', 1, 0)] };
    const fetched: string[] = [];
    const catalog = new BoundaryCatalog('/b/', async (input) => {
      fetched.push(String(input));
      return Response.json(grid);
    });
    const first = catalog.areaShapes('718-835239', TINT_COUNT);
    expect(catalog.areaShapes('718-835239', TINT_COUNT)).toBe(first);
    const shapes = await first;
    expect(shapes.tints.get('a')).not.toBe(shapes.tints.get('b'));
    expect(catalog.areaShapes('720-900000', TINT_COUNT)).not.toBe(first);
    expect(fetched).toEqual(['/b/areas.geojson']);
  });
});

describe('AreaShapes', () => {
  const shapes = AreaColouring.shapes(AREAS, TINT_COUNT);

  it('finds the seat a point lies in, and nothing outside every area', () => {
    expect(shapes.containing([73.02, 26.27])).toBe('s20-ac-128');
    expect(shapes.containing([72.98, 26.25])).toBe('s20-ac-129');
    expect(shapes.containing([77.209, 28.6139])).toBe('u05-pc-4');
    expect(shapes.containing([65, 20])).toBeNull();
  });
});

describe('area tint tokens', () => {
  const tokens = (block: string) => [...block.matchAll(/--area-tint-\d: (#[0-9a-f]{6});/g)].map((match) => match[1]);

  it('are the same values in tokens.css as on the map, for light and both dark blocks', () => {
    const [light, media, theme] = tokensCss.split(/@media \(prefers-color-scheme: dark\)|:root\[data-theme='dark'\]/);
    expect(tokens(light ?? '')).toEqual(AREA_TINTS.light);
    expect(tokens(media ?? '')).toEqual(AREA_TINTS.dark);
    expect(tokens(theme ?? '')).toEqual(AREA_TINTS.dark);
  });

  it('has 8 to 10 tints', () => {
    expect(TINT_COUNT).toBeGreaterThanOrEqual(8);
    expect(TINT_COUNT).toBeLessThanOrEqual(10);
  });

  it('keeps every tint near a party hue (saffron, green, blue, red) muted', () => {
    const loud = [...AREA_TINTS.light, ...AREA_TINTS.dark].filter((hex) => {
      const { hue, saturation } = hsl(hex);
      return PARTY_HUES.some(([from, to]) => hue >= from && hue < to) && saturation > MAX_PARTY_SATURATION;
    });
    expect(loud).toEqual([]);
    // The check itself catches the flag colours and a full red.
    for (const flag of ['#ff9933', '#138808', '#000080', '#ff0000']) expect(PARTY_HUES.some(([from, to]) => hsl(flag).hue >= from && hsl(flag).hue < to)).toBe(true);
  });
});

// Hue ranges (degrees) of saffron, green, blue and red, where a tint must stay greyed.
const PARTY_HUES: readonly (readonly [number, number])[] = [[0, 15], [15, 45], [90, 160], [200, 250], [345, 360]];
const MAX_PARTY_SATURATION = 0.55;

// HSL hue in degrees and saturation 0 to 1 of a #rrggbb colour.
function hsl(hex: string): { readonly hue: number; readonly saturation: number } {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const delta = max - min;
  const light = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  const hue = delta === 0 ? 0 : (sector * 60 + 360) % 360;
  return { hue, saturation };
}
