import { describe, expect, it } from 'vitest';
import { AreaRanking } from '../src/domain/AreaRanking';
import { RankingPresenter } from '../src/features/ranking/RankingPresenter';
import { LocaleFormatter } from '../src/i18n/LocaleFormatter';
import { areaRow } from './areaRows';

const worst = areaRow({ id: 's20-ac-3', name: 'Worst', reports: 20, scores: { city: 20, citizen: 30 } });
const better = areaRow({ id: 's20-ac-1', name: 'Better', reports: 11, scores: { city: 60 } });
const few = areaRow({ id: 's20-ac-2', name: 'Few', reports: 4 });
const none = areaRow({ id: 's20-ac-4', name: 'None', reports: 0 });

describe('AreaRanking.of', () => {
  it('keeps the api order and ranks only areas with a shown score', () => {
    const ranked = AreaRanking.of([worst, better, few, none]);
    expect(ranked.map(({ rank, standing }) => [rank, standing.name])).toEqual([
      [1, 'Worst'],
      [2, 'Better'],
      [null, 'Few'],
      [null, 'None'],
    ]);
  });
});

describe('AreaRanking.compare (the mock api order)', () => {
  it('puts the lowest mean of shown scores first, then withheld areas by reports', () => {
    const sorted = [none, few, better, worst].sort(AreaRanking.compare);
    expect(sorted.map((row) => row.area.name)).toEqual(['Worst', 'Better', 'Few', 'None']);
  });

  it('breaks a tie on more verified reports, then on area id', () => {
    const a = areaRow({ id: 's20-ac-9', reports: 12, scores: { city: 50 } });
    const b = areaRow({ id: 's20-ac-8', reports: 30, scores: { city: 50 } });
    const c = areaRow({ id: 's20-ac-7', reports: 12, scores: { city: 50 } });
    expect([a, b, c].sort(AreaRanking.compare).map((row) => row.area.id)).toEqual(['s20-ac-8', 's20-ac-7', 's20-ac-9']);
  });
});

describe('RankingPresenter', () => {
  const presenter = new RankingPresenter((key, params) => `${key} ${JSON.stringify(params ?? {})}`, new LocaleFormatter('en'));

  it('shows a score with what it rests on', () => {
    const [row] = AreaRanking.of([worst]).map((area) => presenter.row(area));
    expect(row).toMatchObject({ rank: '1', name: 'Worst', score: '25', note: 'ranking.meanOf {"k":"2"}' });
    expect(row?.reports).toBe('ranking.reports {"n":"20"}');
  });

  it('says how many of the 10 reports an unscored area has, and never shows its score', () => {
    const [row] = AreaRanking.of([areaRow({ reports: 4, scores: { city: 10 } })]).map((area) => presenter.row(area));
    expect(row).toMatchObject({ rank: null, score: null, note: 'ranking.notEnough {"n":"4","min":"10"}' });
  });

  it('says the score cannot be measured yet when reports are enough but data is missing', () => {
    const row = areaRow({ reports: 12, scores: { city: 'no_data', citizen: 'no_data', bin_access: 'no_data' } });
    expect(presenter.row(AreaRanking.of([row])[0]!)).toMatchObject({ score: null, note: 'ranking.noData {"n":"12"}' });
  });
});
