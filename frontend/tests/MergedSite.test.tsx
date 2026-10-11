import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { MergedSite } from '../src/domain/MergedSite';
import type { SiteProperties } from '../src/domain/Site';
import { SiteStatusChip } from '../src/domain/SiteStatusChip';
import { SiteClosure } from '../src/features/site/SiteClosure';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import { fixtureSite, renderApp } from './helpers';

// Decision 20261011-1730-hem-merged-sites: a same-spot duplicate is removed as merged and points at its survivor.
vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const merged = async (changes: Partial<Record<string, unknown>> = {}): Promise<SiteProperties> =>
  ({ ...(await fixtureSite('site_jdh_merged')).properties, ...changes }) as SiteProperties;

describe('a merged site', () => {
  it('names the site to open instead, only when it is removed and the id is well formed', async () => {
    expect(MergedSite.target(await merged())).toBe('site_jdh_1');
    expect(MergedSite.target(await merged({ status: 'open' }))).toBeNull();
    expect(MergedSite.target(await merged({ merged_into: 'https://elsewhere.example' }))).toBeNull();
    expect(MergedSite.target(await merged({ merged_into: 'site_jdh_merged' }))).toBeNull();
    expect(MergedSite.target(await merged({ merged_into: null }))).toBeNull();
  });

  it('reads "Merged with a nearby site", with an explainer and a closed reason in English and Hindi', async () => {
    const chip = SiteStatusChip.of(await merged());
    expect(chip).toEqual({ key: 'chip.removedMerged', tone: 'closed' });
    expect(SiteStatusChip.explainKey(chip)).toBe('explain.removedMerged');
    expect(SiteClosure.reasonOf(await merged())).toBe('merged');
    expect(en.chip.removedMerged).toBe('Merged with a nearby site');
    for (const strings of [en, hi]) {
      expect([strings.chip.removedMerged, strings.explain.removedMerged, strings.site.closed.merged].every(Boolean)).toBe(true);
    }
  });

  it('reads as plain removed when its reason is one this app does not know yet', async () => {
    const later = await merged({ removed_reason: 'split_by_hand', merged_into: undefined });
    expect(SiteStatusChip.of(later)).toEqual({ key: 'chip.removed', tone: 'closed' });
    expect(SiteClosure.reasonOf(later)).toBe('removed');
    expect(MergedSite.target(later)).toBeNull();
  });
});

describe('a link to a merged site', () => {
  it('opens the site it merged into, in its place', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_merged', history: 'browser' });
    await waitFor(() => expect(window.location.pathname).toBe('/sites/site_jdh_1'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    expect(screen.queryByText('Merged with a nearby site')).not.toBeInTheDocument();
  });
});
