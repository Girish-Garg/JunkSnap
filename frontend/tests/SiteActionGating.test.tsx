import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { fixtureSite, MemoryStore, renderApp, testServices } from './helpers';
import { testSite } from './siteBuilder';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const ACTIONS = ['Confirm', 'Me too', 'Cleaned', 'Letter', 'Share'];

async function signedIn(siteApi = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), { siteApi });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

function expectNoActions() {
  for (const name of ACTIONS) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Is this a waste site?' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add a note' })).not.toBeInTheDocument();
}

describe('a site off the map shows its status and why, and no votes or actions', () => {
  it('a withdrawn site: no vote, no actions, no backers bar and no empty photo tile', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jdh_5')} userLocation={null} />);
    expect(screen.getByText('Withdrawn')).toHaveClass('badge--removed');
    expect(screen.getByRole('heading', { name: 'No longer on the map' })).toBeInTheDocument();
    expect(screen.getByText(/Its reporter withdrew the report/)).toBeInTheDocument();
    expectNoActions();
    expect(screen.queryByText('1 of 10 people confirmed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Photo not available')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Photos' })).not.toBeInTheDocument();
  });

  it('a site cleared by votes, a cleared no-bin zone and a rejected site each say why', async () => {
    const { unmount } = await renderApp(<SitePanel site={testSite({ status: 'cleaned', cleaned_by: 'votes' })} userLocation={null} />);
    expect(screen.getByText(/Neighbours said it's cleared now/)).toBeInTheDocument();
    expect(screen.getByText('Verified by 10 people')).toBeInTheDocument();
    expectNoActions();
    unmount();
    const zone = await renderApp(<SitePanel site={testSite({ status: 'cleaned', report_type: 'no_bin', context: 'no_bin' })} userLocation={null} />);
    expect(screen.getByText(/A bin is here now/)).toBeInTheDocument();
    zone.unmount();
    await renderApp(<SitePanel site={testSite({ verification: 'rejected', backers: { count: 1, needed: 10, photo_people: 1, vote_people: 0 } })} userLocation={null} />);
    expect(screen.getByText(/Neighbours said this is not a waste site/)).toBeInTheDocument();
    expectNoActions();
  });
});

describe('Letter waits for 10 people', () => {
  it('is off on an unverified site and says why', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jpr_1')} userLocation={null} />);
    expect(screen.getByRole('button', { name: 'Letter' })).toBeDisabled();
    expect(screen.getByText('Letters open once 10 people confirm this site.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
  });

  it('says it in Hindi too', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jpr_1')} userLocation={null} />, { language: 'hi' });
    expect(screen.getByText('10 लोगों के पुष्टि करने के बाद इस स्थल का पत्र बन सकता है।')).toBeInTheDocument();
  });
});

describe('Me too', () => {
  it('sends a yes vote, which backs the site', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn(api) });
    const actions = await screen.findByRole('list', { name: 'Site actions' });
    await user.click(within(actions).getByRole('button', { name: 'Me too' }));
    expect(await screen.findByText('Thanks. Your yes vote backs this site.')).toBeInTheDocument();
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]).toMatchObject({ kind: 'vote', siteId: 'site_jpr_1', body: { vote: 'confirm' } });
  });

  it('says plainly when the api refuses it', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('vote', 403, 'own_site');
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn(api) });
    await user.click(await screen.findByRole('button', { name: 'Me too' }));
    expect(await screen.findByText('You reported this site, so your vote is not counted here.')).toBeInTheDocument();
  });
});

describe('site sheet wording', () => {
  it('puts the nearest bin under its own heading, not under who reported it', async () => {
    await renderApp(<SitePanel site={await fixtureSite('site_jdh_2')} userLocation={null} />);
    const bins = screen.getByRole('heading', { name: 'Bins nearby' }).closest('section');
    expect(bins).toHaveTextContent('Nearest known bin: 4.2 km (OpenStreetMap)');
    const reporters = screen.getByRole('heading', { name: 'Who reported it' }).closest('section');
    expect(reporters).not.toHaveTextContent('Nearest known bin');
  });

  it('counts one person in the singular in Hindi', async () => {
    const one = { count: 1, needed: 10, photo_people: 1, vote_people: 0 };
    await renderApp(<SitePanel site={testSite({ verification: 'unverified', backers: one })} userLocation={null} />, { language: 'hi' });
    expect(screen.getByText('10 में से 1 व्यक्ति ने पुष्टि की')).toBeInTheDocument();
    expect(screen.queryByText(/1 लोगों/)).not.toBeInTheDocument();
  });

  it('counts "it\'s cleared now" votes in the thanks line', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn() });
    await user.click(await screen.findByRole('button', { name: "It's cleared now" }));
    expect(await screen.findByText('Thanks. Votes now: 3 yes, 1 no, 2 cleared.')).toBeInTheDocument();
  });
});
