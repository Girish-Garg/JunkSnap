import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function services(signIn: boolean, siteApi = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const built = testServices(new MemoryStore(), { siteApi });
  if (signIn) {
    await built.auth.signUp('resident@example.com', 'jodhpur2026');
    await built.auth.confirmSignUp('resident@example.com', '123456');
  }
  return built;
}

describe('Notes from residents: the summary', () => {
  it('shows the neutral summary, how many people it rests on and the signal chips, never an author', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(false) });
    expect(await screen.findByRole('heading', { level: 3, name: 'Notes from residents' })).toBeInTheDocument();
    expect(screen.getByText(/Residents say the dump has been here about 3 months/)).toBeInTheDocument();
    expect(screen.getByText('From 4 people · 5 notes')).toBeInTheDocument();
    const chips = screen.getByRole('list', { name: 'What residents mention' });
    expect(chips).toHaveTextContent('Here about 3 months');
    expect(chips).toHaveTextContent('Burning or smoke');
    expect(chips).toHaveTextContent('Near a school');
    expect(chips).not.toHaveTextContent('Near a hospital');
  });

});

describe('Notes from residents: adding a note', () => {
  it('adds a note after sign-in with a 280-character counter and says when it is shown', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(true, api) });
    await user.click(await screen.findByRole('button', { name: 'Add a note' }));
    await user.type(screen.getByLabelText('Your note'), 'Burnt again last night');
    expect(screen.getByText('258 characters left')).toBeInTheDocument();
    await user.click(within(screen.getByRole('group', { name: 'Note language' })).getByRole('button', { name: 'हिन्दी' }));
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Thanks. Your note is shown and joins the summary within 10 minutes.')).toBeInTheDocument();
    expect(api.calls[0]).toMatchObject({ kind: 'note', siteId: 'site_jdh_1', body: { text: 'Burnt again last night', language: 'hi' } });
  });

  it('says plainly when moderation hid the note or the hourly limit is reached', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await services(true, api) });
    await user.click(await screen.findByRole('button', { name: 'Add a note' }));
    await user.type(screen.getByLabelText('Your note'), 'Call 98765 for details');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText(/Your note was not shown/)).toBeInTheDocument();
    api.failNext('note', 429, 'rate_limited');
    await user.type(screen.getByLabelText('Your note'), ' again');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('At most 10 notes an hour.');
  });
});
