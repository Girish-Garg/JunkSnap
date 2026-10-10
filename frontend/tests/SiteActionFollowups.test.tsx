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

const withCleanup = (site: SiteFeature, cleanup_status: CleanupState): SiteFeature => ({ ...site, properties: { ...site.properties, cleanup_status } });

type SetSite = (site: SiteFeature) => void;

interface HarnessProps {
  readonly first: SiteFeature;
  readonly reload: () => void;
  readonly onReady: (set: SetSite) => void;
}

function Harness({ first, reload, onReady }: HarnessProps) {
  const [site, set] = useState(first);
  useEffect(() => onReady(set), [onReady, set]);
  return <CleanupStatus site={site} siteId={first.properties.site_id} reload={reload} />;
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
    act(() => setSite(withCleanup(before, 'accepted')));
    expect(screen.getByText('Cleared')).toBeInTheDocument();
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
