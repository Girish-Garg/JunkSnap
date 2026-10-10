import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import jpr from '../../contracts/fixtures/ward_scores.jpr-1.json';
import { AppRoutes } from '../src/app/AppRoutes';
import { ApiError } from '../src/domain/ApiError';
import type { AreaScores } from '../src/domain/AreaScores';
import { AreaInsightsPresenter } from '../src/features/areas/AreaInsightsPresenter';
import { AreaPresenter, type Translate } from '../src/features/areas/AreaPresenter';
import { LetterRefusal } from '../src/features/letters/LetterRefusal';
import { LocaleFormatter } from '../src/i18n/LocaleFormatter';
import { renderApp } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('ranking letter link', () => {
  it('is open for an area with 10 verified reports and off, with the reason, for the rest', async () => {
    await renderApp(<AppRoutes />, { route: '/ranking' });
    const list = await screen.findByRole('list', { name: 'Areas, worst first' });
    const [first, ...rest] = within(list).getAllByRole('listitem');
    expect(within(first!).getByRole('button', { name: 'Letter' })).toBeEnabled();
    expect(rest.length).toBeGreaterThan(0);
    for (const row of rest) {
      expect(within(row).getByRole('button', { name: 'Letter' })).toHaveAttribute('aria-disabled', 'true');
      expect(row).toHaveTextContent('Opens at 10 verified reports');
    }
  });
});

describe('LetterRefusal', () => {
  it('keeps the counts of a 409 not_verified and drops its English words', () => {
    const area = new ApiError(409, 'not_verified', 'Not enough verified reports yet (3 of 10) for this issue in this area.');
    expect(LetterRefusal.lines(area)).toEqual([{ key: 'notEnough', params: { n: 3, min: 10 } }]);
    const zones = new ApiError(409, 'not_verified', 'No-bin sites left out: Fewer than 10 people have confirmed no dustbin within 1 km (2 sites).');
    expect(LetterRefusal.lines(zones)).toEqual([{ key: 'noBinLeftOut', params: { count: 2 } }]);
  });

  it('has nothing to add for another error or a message without counts', () => {
    expect(LetterRefusal.lines(new ApiError(429, 'rate_limited', 'Slow down'))).toEqual([]);
    expect(LetterRefusal.lines(new ApiError(409, 'not_verified', 'Site is not verified.'))).toEqual([]);
    expect(LetterRefusal.lines(new Error('boom'))).toEqual([]);
  });
});

describe('area insights over no verified sites', () => {
  it('says none is verified yet instead of "0 of 0 sites"', () => {
    const t: Translate = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);
    const base = jpr as AreaScores;
    const insights = base.insights!;
    const measured: AreaScores = {
      ...base,
      insights: { ...insights, near_school_or_water_count: { value: 0, sites: 0, reason: null } },
    };
    const area = new AreaPresenter(measured, t, new LocaleFormatter('en'));
    expect(new AreaInsightsPresenter(measured, area, t, new LocaleFormatter('en')).facts()[1]?.value).toBe('areas.noVerifiedSites');
  });
});
