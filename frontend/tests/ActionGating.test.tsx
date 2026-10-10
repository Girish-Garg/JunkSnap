import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { QueuedReport } from '../src/domain/QueuedReport';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { MemoryReportStore, sampleDraft } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const EMAIL = 'resident@example.com';
const PASSWORD = 'jodhpur2026';
const NOW = new Date('2026-10-10T04:00:00Z');
// site_jpr_1 is an unverified site in Jaipur, so its vote box shows straight away.
const SITE = '/sites/site_jpr_1';

afterEach(() => vi.restoreAllMocks());

// A report this phone sent that the api merged into the site: the api refuses this person's votes there.
function myReport(siteId: string): QueuedReport {
  const view = { report_id: 'rpt_mine', status: 'unverified' as const, site_id: siteId, blurred_url: null, updated_at: '2026-10-10T04:01:00Z' };
  return QueuedReport.capture(sampleDraft('b'.repeat(64)), new ArrayBuffer(1), NOW).sent('rpt_mine').withStatus(view);
}

async function servicesWith(options: { signedIn?: boolean; reports?: readonly QueuedReport[]; api?: FakeSiteActionsApi } = {}): Promise<ServiceContainer> {
  const store = new MemoryReportStore();
  await Promise.all((options.reports ?? []).map((report) => store.put(report.data)));
  const services = testServices(new MemoryStore(), { siteApi: options.api ?? new FakeSiteActionsApi(), store });
  await services.auth.signUp(EMAIL, PASSWORD);
  await services.auth.confirmSignUp(EMAIL, '123456');
  if (options.signedIn === false) await services.auth.signOut();
  return services;
}

const withToasts = (ui: ReactElement) => (
  <>
    {ui}
    <ToastHost />
  </>
);

async function signInThroughSheet(user: UserEvent) {
  const sheet = screen.getByRole('complementary', { name: 'Sign in' });
  await user.type(within(sheet).getByLabelText('Email'), EMAIL);
  await user.type(within(sheet).getByLabelText('Password'), PASSWORD);
  await user.click(within(sheet).getByRole('button', { name: 'Sign in' }));
}

describe('a vote the person cannot make', () => {
  it('looks off, and a tap says why instead of sending: own site', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services: await servicesWith({ reports: [myReport('site_jpr_1')], api }) });
    const yes = await screen.findByRole('button', { name: "Yes, it's waste" }, { timeout: 3000 });
    await waitFor(() => expect(yes).toHaveAttribute('aria-disabled', 'true'));
    expect(yes).toBeEnabled();
    await user.click(yes);
    expect(await screen.findByText('You reported this site, so your vote is not counted here.')).toBeInTheDocument();
    await user.click(within(screen.getByRole('list', { name: 'Site actions' })).getByRole('button', { name: 'Me too' }));
    expect(api.calls).toEqual([]);
  });

});

describe('a vote that needs a connection or a session', () => {
  it('says "You\'re offline" and every sheet shows the offline line', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const api = new FakeSiteActionsApi();
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services: await servicesWith({ api }) });
    expect(await screen.findByText(/You're offline\. Photos wait on this phone/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: "Yes, it's waste" }, { timeout: 3000 }));
    expect(await screen.findByText("You're offline. Try again once you're connected.")).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('asks a signed-out person to sign in with the reason, then sends the vote', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services: await servicesWith({ signedIn: false, api }) });
    const yes = await screen.findByRole('button', { name: "Yes, it's waste" }, { timeout: 3000 });
    expect(yes).not.toHaveAttribute('aria-disabled');
    await user.click(yes);
    expect(screen.getByText('Sign in to vote.')).toBeInTheDocument();
    await signInThroughSheet(user);
    await waitFor(() => expect(api.calls).toEqual([expect.objectContaining({ kind: 'vote', body: expect.objectContaining({ vote: 'confirm' }) })]));
  });
});

describe('a vote the api rate-limited', () => {
  it('holds the vote after a 429 and says why on the next tap', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('vote', 429, 'rate_limited', 'Rate limit exceeded');
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services: await servicesWith({ api }) });
    await user.click(await screen.findByRole('button', { name: "Yes, it's waste" }, { timeout: 3000 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a little and try again.');
    expect(screen.queryByText('Rate limit exceeded')).not.toBeInTheDocument();
    const metoo = within(screen.getByRole('list', { name: 'Site actions' })).getByRole('button', { name: 'Me too' });
    expect(metoo).toHaveAttribute('aria-disabled', 'true');
    await user.click(metoo);
    expect(api.calls).toHaveLength(1);
  });
});

describe('a session the api ended', () => {
  it('opens sign-in, keeps the typed note and sends it after', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = new FakeSiteActionsApi();
    // The first 401 gets one forced token refresh (SignedInStep); the second ends the session.
    api.failNext('note', 401, 'unauthorized');
    api.failNext('note', 401, 'unauthorized');
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services: await servicesWith({ api }) });
    await user.click(await screen.findByRole('button', { name: 'Add a note' }));
    await user.type(screen.getByLabelText('Your note'), 'Burnt again last night');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText("Your sign-in has expired. Sign in again and we'll finish what you started.")).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith('[junksnap:error]', expect.objectContaining({ where: 'note', category: 'auth_expired' }));
    await signInThroughSheet(user);
    expect(await screen.findByText('Thanks. Your note is shown and joins the summary within 10 minutes.')).toBeInTheDocument();
    expect(api.calls.at(-1)).toMatchObject({ kind: 'note', body: { text: 'Burnt again last night' } });
  });
});

describe('a session the api ends twice', () => {
  it('asks to sign in once; a second 401 on the retry only shows the inline line', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = new FakeSiteActionsApi();
    // Each attempt gets one forced token refresh first, so two 401s end one attempt.
    for (let i = 0; i < 4; i += 1) api.failNext('note', 401, 'unauthorized');
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services: await servicesWith({ api }) });
    await user.click(await screen.findByRole('button', { name: 'Add a note' }, { timeout: 3000 }));
    await user.type(screen.getByLabelText('Your note'), 'Burnt again last night');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await signInThroughSheet(user);
    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Sign in again to add a note.');
    expect(screen.queryByRole('complementary', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(api.calls.filter((call) => call.kind === 'note')).toHaveLength(4);
  });
});
