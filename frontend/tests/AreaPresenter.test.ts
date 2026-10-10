import { describe, expect, it } from 'vitest';
import jdh from '../../contracts/fixtures/ward_scores.jdh-1.json';
import jpr from '../../contracts/fixtures/ward_scores.jpr-1.json';
import type { AreaScores } from '../src/domain/AreaScores';
import { AreaInsightsPresenter } from '../src/features/areas/AreaInsightsPresenter';
import { AreaPresenter, type Translate } from '../src/features/areas/AreaPresenter';
import { LocaleFormatter } from '../src/i18n/LocaleFormatter';

const t: Translate = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);
const format = new LocaleFormatter('en');

function presenters(scores: AreaScores) {
  const area = new AreaPresenter(scores, t, format);
  return { area, insights: new AreaInsightsPresenter(scores, area, t, format) };
}

describe('AreaPresenter', () => {
  it('shows each score with the verified report count beside it', () => {
    const [city] = presenters(jdh as AreaScores).area.scores();
    expect(city).toMatchObject({ name: 'city', value: '41', note: 'areas.basedOn {"n":"14"}' });
  });

  it('withholds scores below 10 verified reports and says how many there are', () => {
    const scores = presenters(jpr as AreaScores).area.scores();
    expect(scores.map((score) => score.value)).toEqual([null, null, null]);
    expect(scores[0]?.note).toBe('areas.notEnough {"n":"0","min":"10"}');
    expect(presenters(jpr as AreaScores).area.diagnosis()).toEqual([]);
  });

  it('says a score cannot be measured yet when an input is missing', () => {
    const noData = { ...(jdh as AreaScores), scores: { ...(jdh as AreaScores).scores, citizen: { value: null, reason: 'no_data' } } } as AreaScores;
    expect(presenters(noData).area.scores()[1]?.note).toBe('areas.noData {"n":"14"}');
  });
});

describe('AreaInsightsPresenter', () => {
  it('shows composition, hazards and nearby places only from measured values', () => {
    const { insights } = presenters(jdh as AreaScores);
    expect(insights.composition().shares[0]).toEqual({ label: 'areas.material.plastic', pct: 48.2, text: '48.2%' });
    expect(insights.facts().map((fact) => fact.value)).toEqual([
      '16.7% · areas.ofSites {"part":"1","whole":"6"}',
      'areas.ofSites {"part":"2","whole":"6"}',
      '1',
    ]);
  });

  it('gives the reason in place of a withheld insight', () => {
    const { insights } = presenters(jpr as AreaScores);
    expect(insights.composition()).toEqual({ shares: [], note: 'areas.notEnough {"n":"0","min":"10"}' });
    expect(insights.facts()[1]?.value).toBe('areas.noData {"n":"0"}');
  });

  it('has no insights for the first zero-count row', () => {
    const { insights, ...rest } = jpr as AreaScores;
    expect(insights).toBeDefined();
    expect(presenters(rest as AreaScores).insights.ready()).toBe(false);
  });
});
