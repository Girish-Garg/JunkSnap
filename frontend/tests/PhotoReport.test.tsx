import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { PhotoId } from '../src/domain/PhotoFlag';
import { SiteClosure } from '../src/features/site/SiteClosure';
import { SitePresenter } from '../src/features/site/SitePresenter';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { testSite } from './siteBuilder';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const PHOTOS = [1, 2].map((n) => `https://example.test/media/reports/rpt_test_${n}.jpg`);
const WARNED = [{ photo_id: 'rpt_test_2', count: 3, warned: true, hidden: false }];

async function services(signIn: boolean, siteApi = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const built = testServices(new MemoryStore(), { siteApi });
  if (signIn) {
    await built.auth.signUp('resident@example.com', 'jodhpur2026');
    await built.auth.confirmSignUp('resident@example.com', '123456');
  }
  return built;
}

afterEach(() => {
  window.history.replaceState(null, '');
});

describe('photo ids and warnings', () => {
  it('reads a report photo id from its public URL, never from an after-photo', () => {
    expect(PhotoId.fromUrl('https://d111111abcdef8.cloudfront.net/media/reports/rpt_jdh_1a.jpg')).toBe('rpt_jdh_1a');
    expect(PhotoId.fromUrl('https://d111111abcdef8.cloudfront.net/media/cleanups/cln_jdh_3c.jpg')).toBeNull();
  });

  it('marks only warned photos, and gives the after-photo no id', () => {
    const site = testSite({ photo_urls: PHOTOS, photo_flags: [...WARNED, { photo_id: 'rpt_test_1', count: 2, warned: false, hidden: false }], cleanup_photo_url: 'https://example.test/media/cleanups/cln_test_1.jpg' });
    const photos = new SitePresenter(site.properties).photos();
    expect(photos.map((photo) => [photo.photoId, photo.warned])).toEqual([['rpt_test_1', false], ['rpt_test_2', true], [null, false]]);
  });

  it('never uses a covered photo as the thumbnail of a card or list row', () => {
    const covered = testSite({ photo_urls: PHOTOS, photo_flags: [{ photo_id: 'rpt_test_1', count: 3, warned: true, hidden: false }] });
    expect(new SitePresenter(covered.properties).thumbnail()).toBe(PHOTOS[1]);
    const allCovered = testSite({ photo_urls: PHOTOS.slice(0, 1), photo_flags: [{ photo_id: 'rpt_test_1', count: 3, warned: true, hidden: false }] });
    expect(new SitePresenter(allCovered.properties).thumbnail()).toBeNull();
    expect(new SitePresenter(testSite({ photo_urls: PHOTOS }).properties).thumbnail()).toBe(PHOTOS[0]);
  });

  it('says why a site whose photos were reported left the map', () => {
    const site = testSite({ status: 'removed', verification: 'unverified', removed_reason: 'photos_reported' });
    expect(SiteClosure.reasonOf(site.properties)).toBe('photosReported');
  });
});

describe('the tap-to-view cover', () => {
  it('covers a photo several people reported until it is tapped, in the strip and in the viewer', async () => {
    await renderApp(<SitePanel site={testSite({ photo_urls: PHOTOS, photo_flags: WARNED })} userLocation={null} />);
    const strip = screen.getByRole('list', { name: 'Photos' });
    expect(within(strip).getAllByRole('img')).toHaveLength(1);
    const cover = within(strip).getByRole('button', { name: /Several people reported this photo/ });
    fireEvent.click(cover);
    expect(within(strip).getAllByRole('img')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Blurred photo 2 of 2' }));
    const viewer = screen.getByRole('dialog', { name: 'Photo 2 of 2' });
    expect(within(viewer).queryByRole('img')).toBeNull();
    fireEvent.click(within(viewer).getByRole('button', { name: /Tap to view/ }));
    expect(within(viewer).getByRole('img', { name: 'Blurred photo 2 of 2' })).toBeInTheDocument();
  });

  it('offers no report on a site off the map', async () => {
    await renderApp(<SitePanel site={testSite({ photo_urls: PHOTOS, status: 'removed', verification: 'unverified' })} userLocation={null} />);
    expect(screen.queryByRole('button', { name: /Report photo/ })).toBeNull();
  });
});

describe('reporting a photo', () => {
  it('sends a reason and a description for the photo in view, closes the sheet and thanks with a toast', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(true, api) });
    await user.click(await screen.findByRole('button', { name: 'Report photo 1' }));
    expect(await screen.findByRole('heading', { name: 'Report this photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Unrelated or not waste' }));
    await user.type(screen.getByLabelText('Tell us more (optional)'), 'This is the next street');
    expect(screen.getByText('177 characters left')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText(/Thanks. Your report was counted./)).toBeInTheDocument();
    expect(api.calls.filter((call) => call.kind === 'flagPhoto')).toEqual([
      { kind: 'flagPhoto', siteId: 'site_jdh_1', body: expect.objectContaining({ photoId: 'rpt_jdh_1', reason: 'unrelated', text: 'This is the next street', gps: expect.objectContaining({ lat: expect.any(Number) }) }) },
    ]);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Report this photo' })).toBeNull());
  });
});

describe('when a photo report cannot go through', () => {
  it('says plainly when the photo is the resident\'s own', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('flagPhoto', 403, 'own_photo');
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(true, api) });
    await user.click(await screen.findByRole('button', { name: 'Report photo 1' }));
    await user.click(await screen.findByRole('radio', { name: 'Duplicate' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You took this photo, so a neighbour has to report it.');
  });

  it('holds photo reports for a while after a 429, like every other action', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('flagPhoto', 429, 'rate_limited');
    const built = await services(true, api);
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: built });
    await user.click(await screen.findByRole('button', { name: 'Report photo 1' }));
    await user.click(await screen.findByRole('radio', { name: 'Duplicate' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('At most 10 photo reports an hour.');
    expect(built.cooldowns.active().has('reportPhoto')).toBe(true);
  });

});

describe('when a photo report comes from too far', () => {
  it('says plainly when the resident is more than 1 km away', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('flagPhoto', 403, 'too_far');
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(true, api) });
    await user.click(await screen.findByRole('button', { name: 'Report photo 1' }));
    await user.click(await screen.findByRole('radio', { name: 'Duplicate' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo reports count only within 1 km of the site.');
  });

  it('asks a signed-out resident to sign in before the report sheet opens', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(false) });
    await user.click(await screen.findByRole('button', { name: 'Report photo 1' }));
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Report this photo' })).toBeNull();
  });
});

describe('reporting from the full-screen viewer', () => {
  it('closes the viewer and the sheet opens for that photo', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(true, api) });
    await user.click(await screen.findByRole('button', { name: 'Blurred photo 2 of 2' }));
    const viewer = screen.getByRole('dialog', { name: 'Photo 2 of 2' });
    await user.click(within(viewer).getByRole('button', { name: 'Report this photo' }));
    expect(await screen.findByRole('heading', { name: 'Report this photo' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Photo 2 of 2' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Offensive' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(api.calls.at(-1)).toMatchObject({ kind: 'flagPhoto', body: { photoId: 'rpt_jdh_1a', reason: 'offensive' } }));
    expect(api.calls.at(-1)?.body).not.toHaveProperty('text');
  });
});
