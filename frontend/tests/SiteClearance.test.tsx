import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SiteLifecycle } from '../src/domain/SiteLifecycle';
import { SiteListing } from '../src/domain/SiteListing';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { testSite } from './siteBuilder';

const DAY_MS = 86_400_000;
const PENDING = { cleanup_status: 'pending_confirmation' as const, clearance: { count: 1, needed: 3, still_there: 0 } };

async function signedIn(siteApi: FakeSiteActionsApi) {
  const services = testServices(new MemoryStore(), { siteApi });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

describe('SiteLifecycle (decision 20261010-1855)', () => {
  it('is pending only while an open or reopened site has cleared words', () => {
    expect(new SiteLifecycle({ status: 'open', clearance: { count: 2, needed: 3, still_there: 0 } }).pendingClearance()).toEqual({ count: 2, needed: 3, still_there: 0 });
    expect(new SiteLifecycle({ status: 'open', clearance: { count: 0, needed: 3, still_there: 0 } }).pendingClearance()).toBeNull();
    expect(new SiteLifecycle({ status: 'cleaned', clearance: { count: 3, needed: 3, still_there: 0 } }).pendingClearance()).toBeNull();
    expect(new SiteLifecycle({ status: 'open' }).pendingClearance()).toBeNull();
  });

  it('counts whole days left, never below 0, and none for a site that cannot expire', () => {
    const now = Date.parse('2026-10-10T00:00:00Z');
    const site = (status: 'open' | 'cleaned', days: number) => ({ status, expires_at: new Date(now + days * DAY_MS).toISOString() });
    expect(new SiteLifecycle(site('open', 89.2)).daysLeft(now)).toBe(90);
    expect(new SiteLifecycle(site('open', -3)).daysLeft(now)).toBe(0);
    expect(new SiteLifecycle(site('cleaned', 10)).daysLeft(now)).toBeNull();
    expect(new SiteLifecycle({ status: 'open' }).daysLeft(now)).toBeNull();
  });

  it('keeps expired sites off the map, like the api', () => {
    expect(SiteListing.onMap({ status: 'expired', verification: 'verified' })).toBe(false);
    expect(SiteListing.onMap({ status: 'open', verification: 'verified' })).toBe(true);
  });
});

describe('SitePanel clearing progress', () => {
  it('marks a site reported cleaned and shows how many people agree', async () => {
    await renderApp(<SitePanel site={testSite({ ...PENDING, clearance: { count: 2, needed: 3, still_there: 0 } })} userLocation={null} />);
    expect(screen.getByText('Reported cleaned · 2 of 3 confirmed')).toBeInTheDocument();
    expect(screen.getByText("2 of 3 people say it's cleared")).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: "2 of 3 people say it's cleared" })).toHaveAttribute('value', '2');
  });

  it("sends a cleared vote or a still-there vote from the sheet", async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<SitePanel site={testSite(PENDING)} userLocation={null} />, { services: await signedIn(api) });
    await user.click(screen.getByRole('button', { name: "It's cleared now" }));
    await waitFor(() => expect(api.calls).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Still there' }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    expect(api.calls.map((call) => (call.body as { vote: string }).vote)).toEqual(['cleaned', 'confirm']);
  });

  it('shows nothing about clearing when nobody said it is cleared', async () => {
    await renderApp(<SitePanel site={testSite()} userLocation={null} />);
    expect(screen.queryByText(/people say it's cleared/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Still there' })).not.toBeInTheDocument();
  });
});

describe('SitePanel clearing progress in Hindi', () => {
  it('shows the progress and the buttons in Hindi', async () => {
    await renderApp(<SitePanel site={testSite(PENDING)} userLocation={null} />, { language: 'hi' });
    expect(screen.getByText('3 में से 1 लोग कहते हैं कि यह साफ़ हो गया है')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'अभी भी है' })).toBeInTheDocument();
  });
});

describe('SitePanel expiry line', () => {
  it('says how many days are left unless someone confirms it', async () => {
    const expires = new Date(Date.now() + 30 * DAY_MS - 60_000).toISOString();
    await renderApp(<SitePanel site={testSite({ expires_at: expires })} userLocation={null} />);
    expect(screen.getByText('Expires in 30 days unless someone confirms it')).toBeInTheDocument();
  });

  it('says an expired site left the map, with no countdown or clearing progress', async () => {
    const site = testSite({ status: 'expired', expires_at: '2026-01-01T00:00:00Z', ...PENDING });
    await renderApp(<SitePanel site={site} userLocation={null} />);
    expect(screen.getByText(/This site expired and left the map/)).toBeInTheDocument();
    expect(screen.getByText('Expired')).toHaveClass('badge--expired');
    expect(screen.queryByText(/^Expires/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "It's cleared now" })).not.toBeInTheDocument();
  });

  it('hides the action row and the vote on an expired site', async () => {
    await renderApp(<SitePanel site={testSite({ status: 'expired', verification: 'unverified' })} userLocation={null} />);
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Letter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Yes, it's waste" })).not.toBeInTheDocument();
  });
});
