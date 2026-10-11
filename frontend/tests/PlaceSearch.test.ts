import { describe, expect, it } from 'vitest';
import labelsText from '../public/boundaries/areas_labels.geojson?raw';
import { PlaceSearch, type SeatLabel } from '../src/domain/PlaceSearch';
import type { LabelPoints } from '../src/services/BoundaryCatalog';
import { DEFAULTS } from './config';
import { testSite } from './siteBuilder';

const MAX = DEFAULTS.limits.searchResults;

const sites = [
  testSite({ site_id: 'site_a' }),
  testSite({ site_id: 'site_b', location: { ward: { id: 'test-mc-w12', name: 'Ward 12' } } }),
  testSite({
    site_id: 'site_c',
    location: { state: 'Assam', town: 'Guwahati', ward: null, assembly_seat: null, local_body: null },
  }),
];
const search = new PlaceSearch(sites, [], MAX);

describe('PlaceSearch', () => {
  it('finds a ward by name with its sites', () => {
    const [ward] = search.find('ward 37');
    expect(ward).toMatchObject({ name: 'Ward 37', kind: 'ward' });
    expect(ward?.sites.map((site) => site.properties.site_id)).toEqual(['site_a']);
  });

  it('groups every site of a seat or town', () => {
    const seat = search.find('sardarpura').find((place) => place.kind === 'assembly');
    expect(seat?.sites).toHaveLength(2);
    expect(search.find('guwahati')[0]?.kind).toBe('town');
  });

  it('skips a missing assembly seat and returns nothing for no match', () => {
    expect(search.find('  ')).toEqual([]);
    expect(search.find('mumbai')).toEqual([]);
  });
});

// From public/boundaries/areas_labels.geojson: seats the map ships boundaries for, with no site loaded.
const SEATS: readonly SeatLabel[] = [
  { id: 's20-ac-127', name: 'Sardarpura', kind: 'assembly', point: [73.01, 26.27] },
  { id: 's20-ac-125', name: 'Luni', kind: 'assembly', point: [73.0, 26.0] },
  { id: 's20-pc-16', name: 'Jodhpur', kind: 'loksabha', point: [72.9, 26.5] },
];

describe('PlaceSearch with the shipped seat names', () => {
  const withSeats = new PlaceSearch(sites, SEATS, MAX);

  it('finds a seat with no site on screen and gives its middle to fly to', () => {
    const [luni] = withSeats.find('lun');
    expect(luni).toMatchObject({ name: 'Luni', kind: 'assembly', sites: [], point: [73.0, 26.0] });
  });

  it('merges a seat with the loaded sites in it, keeping both the sites and the middle', () => {
    const seat = withSeats.find('sardar').find((place) => place.kind === 'assembly');
    expect(seat?.sites).toHaveLength(2);
    expect(seat?.point).toEqual([73.01, 26.27]);
    expect(withSeats.find('sardar').filter((place) => place.kind === 'assembly')).toHaveLength(1);
  });

  it('keeps two seats of one name apart, each with its own middle', () => {
    const twins = new PlaceSearch([], [
      { id: 's01-pc-1', name: 'Twin', kind: 'loksabha', point: [77, 12] },
      { id: 's02-pc-9', name: 'Twin', kind: 'loksabha', point: [88, 22] },
    ], MAX).find('twin');
    expect(twins.map((place) => place.point)).toEqual([[77, 12], [88, 22]]);
  });

  it('puts names that start with the text first', () => {
    const names = new PlaceSearch([], [...SEATS, { id: 's20-ac-124', name: 'Bilara', kind: 'assembly', point: [73.7, 26.2] }], MAX).find('l');
    expect(names[0]?.name).toBe('Luni');
  });
});

// Every seat the map ships, as useSeatLabels reads it: Hindi text must find the right one among all 718.
const SHIPPED = (JSON.parse(labelsText) as LabelPoints).features.map(({ properties, geometry }): SeatLabel => ({
  id: properties.id,
  name: properties.name,
  kind: properties.kind,
  point: [geometry.coordinates[0] ?? 0, geometry.coordinates[1] ?? 0],
}));

describe('PlaceSearch in Hindi', () => {
  const shipped = new PlaceSearch(sites, SHIPPED, MAX);

  it.each([
    ['सूरसागर', 'Soorsagar'],
    ['जोधपुर', 'Jodhpur'],
    ['सरदारपुरा', 'Sardarpura'],
    ['लूणी', 'Luni'],
    ['ओसियां', 'Osian'],
    ['फलोदी', 'Phalodi'],
    ['बिलाड़ा', 'Bilara'],
    ['शेरगढ़', 'Shergarh'],
  ])('puts %s first as %s, with its assembly seat', (hindi, name) => {
    const found = shipped.find(hindi);
    // Jodhpur is also the test sites' town, which ranks first because it has sites on the map.
    expect(found[0]?.name).toBe(name);
    expect(found).toContainEqual(expect.objectContaining({ name, kind: 'assembly' }));
  });

  it('finds a ward from the loaded sites by its Hindi name', () => {
    expect(shipped.find('वार्ड 37')[0]).toMatchObject({ name: 'Ward 37', kind: 'ward' });
  });

  it('finds seats across India, and nothing for a locality the app has no name for', () => {
    expect(shipped.find('मुंबई')[0]).toMatchObject({ name: expect.stringMatching(/^Mumbai /) as unknown, kind: 'loksabha' });
    expect(shipped.find('पावटा')).toEqual([]);
  });
});

describe('PlaceSearch in Hindi, सिंह names', () => {
  const shipped = new PlaceSearch(sites, SHIPPED, MAX);

  it.each([
    ['रायसिंहनगर', 'Raisinghnagar'],
    ['जगतसिंहपुर', 'Jagatsinghpur'],
    ['सिंहभूम', 'Singhbhum'],
  ])('reads सिंह as Singh: %s finds %s', (hindi, name) => {
    expect(shipped.find(hindi)[0]?.name).toBe(name);
  });
});
