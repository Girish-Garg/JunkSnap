import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { BinAccess } from '../src/domain/BinAccess';
import { SiteEvidenceView } from '../src/features/site/SiteEvidenceView';
import { MockApiClient } from '../src/services/MockApiClient';
import { MockSiteActionsApi } from '../src/services/MockSiteActionsApi';
import { sampleLetterLoader, siteFixtureLoaders } from '../src/services/siteFixtures';
import { DEFAULTS } from './config';
import { fixtureSite, MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore());
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

describe('bin access and reporters', () => {
  it('reads the reporters and the nearest bin of a no-bin zone; its n of 10 is the backers bar', async () => {
    const site = (await fixtureSite('site_jdh_2')).properties;
    expect(SiteEvidenceView.lines(site, DEFAULTS.site.zoneRadiusM)).toEqual([
      { key: 'reporters', count: 3 },
      { key: 'bin.nearest', metres: 4210 },
    ]);
  });

  it('says bins are not mapped, or nothing at all for rows from before bins were measured', () => {
    expect(BinAccess.line(null, null)).toEqual({ key: 'notMapped' });
    expect(BinAccess.line(null, true)).toEqual({ key: 'noneWithin3km' });
    expect(BinAccess.line(undefined, undefined)).toBeNull();
    const { i18n } = testServices().localization;
    expect(i18n.t('site.bin.noneWithin3km', { lng: 'en' })).toBe('No known bin within 3 km (OpenStreetMap, ward records)');
  });

  it('shows how many people reported a no-bin site and how far the nearest bin is', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_2' });
    expect(await screen.findByText('3 people reported this')).toBeInTheDocument();
    expect(screen.getByText('Nearest known bin: 4.2 km (OpenStreetMap)')).toBeInTheDocument();
  });
});

describe('letter evidence', () => {
  it('shows counts, dates, blurred photos, measured insights and the nearest bin with the letter', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1/letter', services: await signedIn() });
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    const letter = await screen.findByRole('article');
    expect(within(letter).getByRole('heading', { name: 'Evidence' })).toBeInTheDocument();
    expect(within(letter).getByText('People who reported').nextSibling).toHaveTextContent('5');
    expect(within(letter).getAllByRole('img', { name: /Blurred photo/ })).toHaveLength(2);
    expect(within(letter).getByText('Plastic about 53% (6 reports)')).toBeInTheDocument();
    expect(within(letter).getByText('Medium pile')).toBeInTheDocument();
    expect(within(letter).getByText('Near a school, 80 m (OpenStreetMap)')).toBeInTheDocument();
    expect(within(letter).getByText('Nearest known bin: 1.8 km (OpenStreetMap)')).toBeInTheDocument();
    expect(within(letter).getByText('Community check').nextSibling).toHaveTextContent('Verified by 10 people');
  });

  it('drafts a letter for a no-bin zone once 10 people verified it', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_2/letter', services: await signedIn() });
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    expect(await screen.findByRole('article')).toBeInTheDocument();
  });

  it('opens no-bin letters in mock mode for a verified zone, whatever the reporter count (decision 20261010-1630)', async () => {
    const sites = new MockApiClient(siteFixtureLoaders);
    const api = new MockSiteActionsApi({ site: (id) => sites.getSite(id), letter: sampleLetterLoader }, 0);
    await expect(api.letter('site_jdh_2', { device_token: 'x', channel: 'local_body', language: 'en' })).resolves.toHaveProperty('site_id', 'site_jdh_2');
  });
});

describe('letter evidence for an unverified site (decision 20261011-1750)', () => {
  it('drafts in mock mode, with the site standing in the evidence', async () => {
    const sites = new MockApiClient(siteFixtureLoaders);
    const api = new MockSiteActionsApi({ site: (id) => sites.getSite(id), letter: sampleLetterLoader }, 0);
    const waiting = await api.letter('site_jpr_1', { device_token: 'x', channel: 'local_body', language: 'en' });
    expect(waiting.evidence).toMatchObject({ verification: 'unverified', backers: { count: 2, needed: 10 } });
  });

  it('keeps the note after drafting and says how many people confirmed it', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1/letter', services: await signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Draft letter' }));
    const letter = await screen.findByRole('article');
    expect(within(letter).getByText('Community check').nextSibling).toHaveTextContent('2 of 10 people confirmed so far');
    expect(screen.getByText('This spot is not verified yet. The letter says how many residents have reported it.')).toBeInTheDocument();
  });

  it('says it in Hindi in a Hindi letter', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1/letter', services: await signedIn(), language: 'hi' });
    await user.click(await screen.findByRole('button', { name: 'पत्र का मसौदा बनाएँ' }));
    const letter = await screen.findByRole('article');
    expect(within(letter).getByText('सामुदायिक पुष्टि').nextSibling).toHaveTextContent('अब तक 10 में से 2');
  });
});
