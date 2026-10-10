import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { ReportUpload } from '../src/domain/ReportUpload';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { FakeReportApi } from './FakeReportApi';
import { fixtureSite, MemoryStore, renderApp, testServices } from './helpers';
import { testSite } from './siteBuilder';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(api: FakeReportApi): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), { api });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

const addPhoto = () => screen.getByRole('button', { name: 'Add a photo' });

describe('a site shows every photo with a count', () => {
  it('counts the report photos and the cleanup after-photo', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jdh_3')} userLocation={null} />);
    expect(screen.getByText('3 photos')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Blurred photo/ })).toHaveLength(3);
  });

  it('says one photo, and no photos for a site without one', async () => {
    await renderApp(<SitePanel site={testSite()} userLocation={null} />);
    expect(screen.getByText('1 photo')).toBeInTheDocument();
    await renderApp(<SitePanel site={testSite({ photo_urls: [] })} userLocation={null} />);
    expect(screen.getByText('No photos yet')).toBeInTheDocument();
  });
});

describe('Add a photo says why it cannot work yet', () => {
  it('is muted on a closed site, and the tap opens nothing', async () => {
    const user = userEvent.setup();
    await renderApp(<SitePanel site={await fixtureSite('site_jdh_5')} userLocation={null} />);
    expect(addPhoto()).toHaveAttribute('aria-disabled', 'true');
    expect(addPhoto()).toHaveAccessibleDescription('This site is closed, so it takes no new photos.');
    await user.click(addPhoto());
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('is muted when the person is clearly too far from the site', async () => {
    await renderApp(<SitePanel site={testSite()} userLocation={[73.1, 26.4]} />);
    expect(addPhoto()).toHaveAttribute('aria-disabled', 'true');
    expect(addPhoto()).toHaveAccessibleDescription('Go within 490 m of the site to add a photo.');
  });

  it('asks a signed-out person to sign in, and the tap opens sign-in', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    await screen.findByRole('heading', { level: 2, name: 'Waste dump' });
    expect(addPhoto()).not.toHaveAttribute('aria-disabled');
    expect(addPhoto()).toHaveAccessibleDescription('Sign in to add a photo.');
    await user.click(addPhoto());
    expect(await screen.findByRole('heading', { name: /Sign in/ })).toBeInTheDocument();
  });
});

describe('Add a photo opens Snap preset to the site', () => {
  it('sends the site type and context with me_too_site_id, and no type to pick', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await signedIn(api) });
    await screen.findByRole('heading', { level: 2, name: 'Waste dump' });
    await user.click(addPhoto());
    expect(await screen.findByRole('heading', { level: 2, name: 'Add a photo to this site' })).toBeInTheDocument();
    const shutter = await screen.findByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    expect(await screen.findByText('For this site: Waste dump. You are at the site.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'No bin or pickup' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(api.bodies('submit')).toHaveLength(1));
    const upload = api.bodies('submit')[0] as ReportUpload;
    expect(upload).toMatchObject({ report_type: 'waste_dump', context: 'vacant_plot', me_too_site_id: 'site_jdh_1', capture_mode: 'snap' });
    expect(upload.target).toBeUndefined();
    expect(await screen.findByText('Once it passes the checks, it may join this site’s photos.')).toBeInTheDocument();
  });
});

describe('Snap for a site never falls back to a new report', () => {
  it('shows no camera while the site loads, for a closed site, or for one that cannot be read', async () => {
    const services = await signedIn(new FakeReportApi());
    await renderApp(<AppRoutes />, { route: '/snap?site=site_jdh_5', services });
    expect(screen.getByText('Reading the site…')).toBeInTheDocument();
    expect(await screen.findByText('This site is closed, so it takes no new photos.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take photo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Video' })).not.toBeInTheDocument();
    await renderApp(<AppRoutes />, { route: '/snap?site=site_missing', services });
    expect(await screen.findByText(/This site could not be read/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take photo' })).not.toBeInTheDocument();
  });
});
