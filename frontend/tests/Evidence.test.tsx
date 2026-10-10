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
import { fixtureSite, MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore());
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

describe('bin access and reporters', () => {
  it('reads the no-bin threshold and the nearest bin from a v1.4 site', async () => {
    const site = (await fixtureSite('site_jdh_2')).properties;
    expect(SiteEvidenceView.lines(site)).toEqual([
      { key: 'reporters', count: 3 },
      { key: 'noBinReporters', count: 3, min: 5 },
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
    expect(screen.getByText('3 of 5 people reported no bin here')).toBeInTheDocument();
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
  });

  it('shows the reason a no-bin letter is not ready, as the api words it', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_2/letter', services: await signedIn() });
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('3 of 5 people reported no bin here; nearest known bin 4.2 km');
  });

  it('refuses a no-bin letter in mock mode until five people reported and no bin is within 3 km', async () => {
    const sites = new MockApiClient(siteFixtureLoaders);
    const api = new MockSiteActionsApi({ site: (id) => sites.getSite(id), letter: sampleLetterLoader }, 0);
    await expect(api.letter('site_jdh_2', { device_token: 'x', channel: 'local_body', language: 'en' })).rejects.toMatchObject({ status: 409, code: 'not_verified' });
    await expect(api.letter('site_jdh_1', { device_token: 'x', channel: 'local_body', language: 'en' })).resolves.toHaveProperty('evidence.reporters', 5);
  });
});
