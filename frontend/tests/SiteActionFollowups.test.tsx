import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { ApiError } from '../src/domain/ApiError';
import { AuthError } from '../src/domain/AuthError';
import type { CleanupStatus as CleanupState, SiteFeature } from '../src/domain/Site';
import { CleanupStatus } from '../src/features/cleanup/components/CleanupStatus';
import { ActionProblem } from '../src/features/site/ActionProblem';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { fixtureSite, MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(siteApi = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), { siteApi });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

const withCleanup = (site: SiteFeature, cleanup_status: CleanupState, cleanup_photo_url: string | null = null): SiteFeature => ({ ...site, properties: { ...site.properties, cleanup_status, cleanup_photo_url } });

// The blurred copy of an after-photo that passed, as the worker names it (contracts/README.md, S3 key layout).
const OURS = 'https://cdn.test/media/cleanups/cln_test_b.jpg';
const EARLIER = 'https://cdn.test/media/cleanups/cln_test_a.jpg';

type SetSite = (site: SiteFeature) => void;

interface HarnessProps {
  readonly first: SiteFeature;
  readonly reload: () => void;
  readonly onReady: (set: SetSite) => void;
}

function Harness({ first, reload, onReady }: HarnessProps) {
  const [site, set] = useState(first);
  useEffect(() => onReady(set), [onReady, set]);
  return <CleanupStatus site={site} siteId={first.properties.site_id} cleanupId="cln_test_b" reload={reload} />;
}

describe('cleanup status after a new claim', () => {
  it('shows checking, not the old rejection, until a read made after the claim comes back', async () => {
    const reload = vi.fn();
    const before = withCleanup(await fixtureSite('site_jdh_1'), 'rejected');
    let setSite: SetSite = () => undefined;
    await renderApp(<Harness first={before} reload={reload} onReady={(set) => (setSite = set)} />);
    expect(screen.getByText('Being checked')).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
    act(() => setSite(withCleanup(before, 'checking')));
    expect(screen.getByText('Being checked')).toBeInTheDocument();
    act(() => setSite(withCleanup(before, 'accepted', OURS)));
    expect(screen.getByText('Cleared')).toBeInTheDocument();
  });
});

describe('cleanup status when an earlier photo already counts', () => {
  it('reads a rejected photo as not accepted when an earlier photo keeps the site pending', async () => {
    const before = withCleanup(await fixtureSite('site_jdh_1'), 'pending_confirmation', EARLIER);
    let setSite: SetSite = () => undefined;
    await renderApp(<Harness first={before} reload={vi.fn()} onReady={(set) => (setSite = set)} />);
    act(() => setSite(withCleanup(before, 'checking', EARLIER)));
    expect(screen.getByText('Being checked')).toBeInTheDocument();
    act(() => setSite(withCleanup(before, 'pending_confirmation', EARLIER)));
    expect(screen.getByText('Not accepted')).toBeInTheDocument();
  });
});

describe('cleanup status once a result was shown', () => {
  it('keeps Counted once shown, when a newer photo replaces the after-photo or the site is removed', async () => {
    const before = withCleanup(await fixtureSite('site_jdh_1'), 'checking', EARLIER);
    let setSite: SetSite = () => undefined;
    await renderApp(<Harness first={before} reload={vi.fn()} onReady={(set) => (setSite = set)} />);
    act(() => setSite(withCleanup(before, 'pending_confirmation', OURS)));
    expect(screen.getByText('Counted')).toBeInTheDocument();
    act(() => setSite(withCleanup(before, 'pending_confirmation', 'https://cdn.test/media/cleanups/cln_test_c.jpg')));
    expect(screen.getByText('Counted')).toBeInTheDocument();
    act(() => setSite(withCleanup(before, 'none', null)));
    expect(screen.getByText('Counted')).toBeInTheDocument();
  });

  it('counts this photo once the site shows its blurred copy', async () => {
    const before = withCleanup(await fixtureSite('site_jdh_1'), 'pending_confirmation', EARLIER);
    let setSite: SetSite = () => undefined;
    await renderApp(<Harness first={before} reload={vi.fn()} onReady={(set) => (setSite = set)} />);
    act(() => setSite(withCleanup(before, 'pending_confirmation', OURS)));
    expect(screen.getByText('Counted')).toBeInTheDocument();
  });
});

describe('copying a letter', () => {
  it('says so when the clipboard refuses', async () => {
    const user = userEvent.setup();
    const services = await signedIn();
    vi.spyOn(services.sharer, 'copy').mockRejectedValue(new Error('denied'));
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1/letter', services });
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    await user.click(await screen.findByRole('button', { name: 'Copy text' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy. Select the letter text and copy it yourself.');
  });
});

describe('a sign-in the api still refuses after a refresh', () => {
  it('asks to sign in again for a vote, a cleanup and a letter', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('vote', 401, 'unauthorized');
    api.failNext('vote', 401, 'unauthorized');
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn(api) });
    await user.click(await screen.findByRole('button', { name: "Yes, it's waste" }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your sign-in has expired. Sign in again'));
    expect(api.calls.filter((call) => call.kind === 'vote')).toHaveLength(2);
  });

  it('maps every action error the same way', () => {
    const known = new Set(['too_far']);
    expect(ActionProblem.of(new ApiError(401, 'unauthorized', 'x'), known)).toBe('sign_in');
    expect(ActionProblem.of(new AuthError('wrong_credentials', 'x'), known)).toBe('sign_in');
    expect(ActionProblem.of(new AuthError('network', 'x'), known)).toBe('offline');
    expect(ActionProblem.of(new ApiError(403, 'too_far', 'x'), known)).toBe('too_far');
    expect(ActionProblem.of(new ApiError(409, 'not_verified', 'x'), known)).toBe('failed');
  });
});
