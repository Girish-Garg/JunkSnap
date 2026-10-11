import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { findEnabledButton, MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(siteApi = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), { siteApi });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

describe('community vote', () => {
  it('shows the neighbour check on a community-check site and counts the vote', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn() });
    await user.click(await findEnabledButton("Yes, it's waste"));
    expect(await screen.findByText('Thanks. Votes now: 3 yes, 1 no, 2 cleared.')).toBeInTheDocument();
  });

  it('says plainly when the voter reported the site or is too far away', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('vote', 403, 'too_far');
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn(api) });
    await user.click(await findEnabledButton('No'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Votes count only within 1 km of the site.');
  });
});

describe('cleanup claim', () => {
  it('takes the after-photo in the app, sends it and shows that it is being checked', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    // site_jdh_1 already has a cleanup photo being checked, so its cleanup link is locked (issue 124); jdh_3 takes one.
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_3/cleanup', services: await signedIn(api) });
    const shutter = await screen.findByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    await user.click(await screen.findByRole('button', { name: 'Send cleanup photo' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Cleanup photo sent' })).toBeInTheDocument();
    expect(screen.getByText('Being checked')).toBeInTheDocument();
    expect(api.calls[0]).toMatchObject({ kind: 'cleanup', siteId: 'site_jdh_3' });
  });
});

describe('letter draft', () => {
  it('drafts a cited letter addressed to offices, for the resident to file', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1/letter', services: await signedIn() });
    expect(screen.getByText('Draft for you to file. JunkSnap never sends or files anything.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    const letter = await screen.findByRole('article');
    expect(within(letter).getByText('Commissioner, Jodhpur Municipal Corporation')).toBeInTheDocument();
    expect(within(letter).getByText('MLA, Jodhpur assembly seat (for attention)')).toBeInTheDocument();
    expect(within(letter).getByText('2 of 2 quotes verified word for word')).toBeInTheDocument();
    expect(within(letter).getAllByText('bbf4755536af0161df6c0d9f0b89282c8f6bec3c471631d41bbded1dafbdcf86')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeInTheDocument();
  });

  it('labels a Hindi letter in Hindi and explains a site neighbours hid meanwhile', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1/letter', services: await signedIn(api) });
    await user.click(within(screen.getByRole('group', { name: 'Letter language' })).getByRole('button', { name: 'हिन्दी' }));
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    const letter = await screen.findByRole('article');
    expect(letter).toHaveAttribute('lang', 'hi');
    expect(within(letter).getByText('विधायक, Jodhpur विधानसभा क्षेत्र (ध्यानार्थ)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Draft again' }));
    api.failNext('letter', 409, 'site_rejected');
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Neighbours said this is not a waste site, so it takes no letters.');
  });
});
