import { describe, expect, it } from 'vitest';
import assemblyText from '../../data/boundaries/rajasthan_assembly.geojson?raw';
import loksabhaText from '../../data/boundaries/india_loksabha.geojson?raw';
import localBodies from '../../data/representatives/local_bodies.json';
import { AreaDirectory } from '../src/domain/AreaDirectory';
import type { AreaListing } from '../src/domain/AreaListing';
import { AreaProgress } from '../src/domain/AreaProgress';
import type { AreaKind, AreaScores } from '../src/domain/AreaScores';
import { PILOT_AREAS, PILOT_LOCAL_BODY, pilotArea } from '../src/domain/PilotAreas';
import { AreaProgressText } from '../src/features/areas/AreaProgressText';
import { LocaleFormatter } from '../src/i18n/LocaleFormatter';
import { areaRow } from './areaRows';
import { DEFAULTS } from './config';

interface SeatProperties {
  readonly id: string;
  readonly name: string;
  readonly pc_id?: string;
}

const seats = (text: string) => (JSON.parse(text) as { features: { properties: SeatProperties }[] }).features.map((f) => f.properties);
const ASSEMBLY = new Map(seats(assemblyText).map((seat) => [seat.id, seat]));
const LOKSABHA = new Map(seats(loksabhaText).map((seat) => [seat.id, seat]));
const ofKind = (kind: AreaKind) => PILOT_AREAS.filter((area) => area.kind === kind);

describe('PILOT_AREAS against the shipped boundary data', () => {
  it('lists the eight assembly seats of Jodhpur district by their ids and names in rajasthan_assembly.geojson', () => {
    const assembly = ofKind('assembly');
    expect(assembly.map((area) => area.id)).toEqual(['s20-ac-124', 's20-ac-125', 's20-ac-126', 's20-ac-127', 's20-ac-128', 's20-ac-129', 's20-ac-130', 's20-ac-131']);
    for (const area of assembly) expect(ASSEMBLY.get(area.id)?.name).toBe(area.name);
  });

  it('lists exactly the Lok Sabha seats those assembly seats belong to, named as in india_loksabha.geojson', () => {
    const parents = new Set(ofKind('assembly').map((area) => ASSEMBLY.get(area.id)?.pc_id));
    expect(new Set(ofKind('loksabha').map((area) => area.id))).toEqual(parents);
    for (const area of ofKind('loksabha')) expect(LOKSABHA.get(area.id)?.name).toBe(area.name);
  });

  it('has the district id the geocoder writes and the local body of data/representatives', () => {
    expect(ofKind('district').map((area) => area.id)).toEqual(['rajasthan-jodhpur']);
    expect(localBodies.find((body) => body.id === PILOT_LOCAL_BODY.id)?.name).toBe(PILOT_LOCAL_BODY.name);
    expect(pilotArea('assembly', 's20-ac-125')?.name).toBe('Osian');
    expect(pilotArea('assembly', 's20-ac-54')).toBeNull();
  });
});

const listing = (areas: readonly AreaScores[]): AreaListing => ({ kind: 'assembly', within: 'rajasthan-jodhpur', total: areas.length, limit: 200, areas });

describe('AreaDirectory.of with the pilot areas', () => {
  const jodhpur = areaRow({ id: 's20-ac-128', name: 'Jodhpur', reports: 12, scores: { city: 40, citizen: 50, bin_access: 60 } });
  const elsewhere = areaRow({ id: 's20-ac-54', name: 'Kishanpole', reports: 2 });

  it('keeps every pilot area, fills in the rows the list route has, and adds reported areas from elsewhere', () => {
    const entries = AreaDirectory.of([listing([jodhpur, elsewhere])], PILOT_AREAS);
    expect(entries.filter((entry) => entry.area.kind === 'assembly')).toHaveLength(9);
    expect(entries.find((entry) => entry.area.id === 's20-ac-128')?.row).toBe(jodhpur);
    expect(entries.find((entry) => entry.area.id === 's20-ac-54')?.row).toBe(elsewhere);
    expect(entries.find((entry) => entry.area.id === 's20-ac-125')?.row).toBeNull();
    expect(entries.map((entry) => entry.area.kind)).toEqual([...entries.map((entry) => entry.area.kind)].sort((a, b) => ['assembly', 'loksabha', 'district'].indexOf(a) - ['assembly', 'loksabha', 'district'].indexOf(b)));
  });

  it('lists the pilot areas even when the list route has no rows at all', () => {
    expect(AreaDirectory.of([listing([])], PILOT_AREAS)).toHaveLength(PILOT_AREAS.length);
  });

  it('marks a pilot area unloaded, never zero, when the list of its kind failed', () => {
    const entries = AreaDirectory.of([], PILOT_AREAS, new Set(['assembly']));
    expect(entries.filter((entry) => entry.area.kind === 'assembly').every((entry) => entry.unloaded && entry.row === null)).toBe(true);
    expect(entries.filter((entry) => entry.area.kind !== 'assembly').some((entry) => entry.unloaded)).toBe(false);
  });
});

const MIN = DEFAULTS.site.minVerifiedReports;

describe('AreaProgress in words', () => {
  const text = new AreaProgressText((key, params) => `${key} ${JSON.stringify(params ?? {})}`, new LocaleFormatter('en'));

  it('says "No reports yet" with zero counts for an area without a row', () => {
    const progress = AreaProgress.of(null, MIN);
    expect(progress).toMatchObject({ stage: 'none', sites: 0, verified: 0, min: 10, score: null });
    expect(text.lines(progress)).toEqual({ counts: 'areas.rowCounts {"sites":"0","verified":"0"}', status: 'areas.noReports {}' });
  });

  it('says "Not enough reports yet (n of 10)" below 10 verified reports, whatever the row holds', () => {
    const progress = AreaProgress.of(areaRow({ reports: 9, scores: { city: 30 } }), MIN);
    expect(progress).toMatchObject({ stage: 'few', verified: 9, score: null });
    expect(text.lines(progress).status).toBe('areas.notEnough {"n":"9","min":"10"}');
  });

  it('never says "No reports yet" once a row exists, even when its sites have since cleared or expired', () => {
    const row = areaRow({ reports: 0 });
    const cleared = { ...row, counts: { ...row.counts, sites: 0, open_sites: 0 } };
    expect(AreaProgress.of(cleared, MIN)).toMatchObject({ stage: 'few', sites: 0 });
  });

});

describe('AreaProgress in words, from 10 verified reports', () => {
  const text = new AreaProgressText((key, params) => `${key} ${JSON.stringify(params ?? {})}`, new LocaleFormatter('en'));

  it('says "Score withheld for now", not "Not enough reports", when 10+ verified reports still have no score', () => {
    const progress = AreaProgress.of(areaRow({ reports: 12, scores: { city: 'no_data', citizen: 'no_data', bin_access: 'no_data' } }), MIN);
    expect(progress).toMatchObject({ stage: 'withheld', verified: 12, score: null });
    expect(text.lines(progress).status).toBe('areas.scoreWithheld {}');
  });

  it('shows the mean of the shown scores with its count from 10 verified reports', () => {
    const progress = AreaProgress.of(areaRow({ reports: 12, scores: { city: 40, citizen: 50, bin_access: 60 } }), MIN);
    expect(progress).toMatchObject({ stage: 'scored', score: 50 });
    expect(text.lines(progress).status).toBe('areas.scoreLine {"n":"50","reports":"12"}');
  });
});
