import { describe, expect, it } from 'vitest';
import { AreaStanding } from '../src/domain/AreaStanding';
import { ChoroplethScale } from '../src/features/map/ChoroplethScale';
import { areaRow } from './areaRows';

describe('AreaStanding', () => {
  it('is the rounded mean of the shown scores', () => {
    const standing = new AreaStanding(areaRow({ reports: 14, scores: { city: 41, citizen: 58, bin_access: 32 } }));
    expect(standing.shown).toEqual(['city', 'citizen', 'bin_access']);
    expect(standing.score).toBe(44);
  });

  it('leaves out scores withheld for missing data', () => {
    const standing = new AreaStanding(areaRow({ reports: 12, scores: { city: 30, citizen: 'no_data', bin_access: 'no_data' } }));
    expect(standing.shown).toEqual(['city']);
    expect(standing.score).toBe(30);
  });

  it('never shows a score below 10 verified reports, even if a row carries one', () => {
    const standing = new AreaStanding(areaRow({ reports: 9, scores: { city: 41 } }));
    expect(standing.score).toBeNull();
    expect(standing.scored).toBe(false);
  });
});

describe('ChoroplethScale.fill', () => {
  it('fills by score when a score shows, darkest for the worst', () => {
    expect(ChoroplethScale.fill(areaRow({ reports: 10, scores: { city: 5 } }))).toEqual({ basis: 'score', step: 4, color: '#8c1412' });
    expect(ChoroplethScale.fill(areaRow({ reports: 10, scores: { city: 44 } }))).toMatchObject({ basis: 'score', step: 2 });
    expect(ChoroplethScale.fill(areaRow({ reports: 10, scores: { city: 100 } }))).toMatchObject({ basis: 'score', step: 0 });
  });
});

describe('ChoroplethScale.fill without a shown score', () => {
  it('falls back to the report count while every score is withheld', () => {
    const fill = ChoroplethScale.fill(areaRow({ reports: 4 }));
    expect(fill).toEqual({ basis: 'count', step: 1, color: '#c4c7c5' });
  });

  it('uses the count, not a withheld score, when a row has a value under the minimum', () => {
    expect(ChoroplethScale.fill(areaRow({ reports: 9, scores: { city: 5 } }))).toMatchObject({ basis: 'count', step: 2 });
  });

  it('counts an area with enough reports but nothing measurable in the darkest grey', () => {
    const row = areaRow({ reports: 25, scores: { city: 'no_data', citizen: 'no_data', bin_access: 'no_data' } });
    expect(ChoroplethScale.fill(row)).toMatchObject({ basis: 'count', step: 3 });
  });

  it('leaves an area with no verified reports unfilled', () => {
    expect(ChoroplethScale.fill(areaRow({ reports: 0 }))).toBeNull();
  });
});

describe('ChoroplethScale ramps', () => {
  it('keeps the score and count ramps apart', () => {
    const scoreColors = ChoroplethScale.scoreSteps.map((step) => step.color);
    expect(ChoroplethScale.countSteps.some((step) => scoreColors.includes(step.color))).toBe(false);
  });

  it('maps area ids to colours, skipping areas with nothing to show', () => {
    const colors = ChoroplethScale.colors([areaRow({ id: 's20-ac-1', reports: 12, scores: { city: 50 } }), areaRow({ id: 's20-ac-2' })]);
    expect([...colors.keys()]).toEqual(['s20-ac-1']);
  });
});
