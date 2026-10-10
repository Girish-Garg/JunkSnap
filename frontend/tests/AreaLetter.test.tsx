import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { AreaLetterDraft, AreaLetterRequest } from '../src/domain/AreaLetter';
import type { AreaKind } from '../src/domain/AreaScores';
import type { AreaLetterApi } from '../src/services/AreaLetterApi';
import { AreaLetterService } from '../src/services/AreaLetterService';
import { HttpAreaLetterApi } from '../src/services/HttpAreaLetterApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { DEVICE_TOKEN, fixedIdentity } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore());
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

class RecordingApi implements AreaLetterApi {
  readonly calls: { kind: AreaKind; id: string; request: AreaLetterRequest }[] = [];

  async letter(kind: AreaKind, id: string, request: AreaLetterRequest): Promise<AreaLetterDraft> {
    this.calls.push({ kind, id, request });
    throw new Error('not needed');
  }
}

describe('area letter request', () => {
  it('sends the issue, the language and the device token, and nothing without a sign-in', async () => {
    const api = new RecordingApi();
    await new AreaLetterService(api, fixedIdentity('id-token')).letter({ kind: 'assembly', id: 's20-ac-128' }, 'no_bin', 'hi').catch(() => undefined);
    expect(api.calls).toEqual([{ kind: 'assembly', id: 's20-ac-128', request: { issue: 'no_bin', language: 'hi', device_token: DEVICE_TOKEN } }]);
    await expect(new AreaLetterService(api, fixedIdentity(null)).letter({ kind: 'ward', id: 'x' }, 'all', 'en')).rejects.toMatchObject({ problem: 'wrong_credentials' });
    expect(api.calls).toHaveLength(1);
  });

  it('posts to /areas/{kind}/{id}/letters', async () => {
    const urls: string[] = [];
    const fetcher: typeof fetch = async (input) => (urls.push(String(input)), new Response('{}', { status: 200 }));
    await new HttpAreaLetterApi('https://api.test', fixedIdentity('t'), fetcher).letter('assembly', 's20-ac-128', { issue: 'all', language: 'en', device_token: DEVICE_TOKEN });
    expect(urls).toEqual(['https://api.test/areas/assembly/s20-ac-128/letters']);
  });
});

describe('area letter sheet', () => {
  it('drafts a letter about an area with its counts, scores, worst sites and bin access', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128', services: await signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Draft a letter about this area' }));
    expect(screen.getByRole('radio', { name: 'Waste dumps' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    const letter = await screen.findByRole('article');
    expect(within(letter).getByText('Commissioner, Jodhpur Municipal Corporation')).toBeInTheDocument();
    expect(within(letter).getByText('City response: 41/100 (from 14 verified reports)')).toBeInTheDocument();
    expect(within(letter).getByText('1 of 3 measured sites have no known bin within 3 km (OpenStreetMap, ward records)')).toBeInTheDocument();
    expect(within(letter).getByText('Waste dump, Vacant plot · Open: 7 reports, 6 verified')).toBeInTheDocument();
    expect(within(letter).getByText('Plastic about 53% (6 reports)')).toBeInTheDocument();
    expect(within(letter).getAllByRole('img', { name: /Blurred photo/ })).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Letter about Jodhpur' })).toBeInTheDocument();
  });
});

describe('area letter issues', () => {
  it('offers overflowing or broken bins as an issue and drafts the letter about it', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128/letter', services: await signedIn() });
    await user.click(screen.getByRole('radio', { name: 'Overflowing or broken bins' }));
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    const letter = await screen.findByRole('article');
    expect(within(letter).queryByText(/no known bin within 3 km/)).not.toBeInTheDocument();
  });
});

describe('area letter refusals', () => {
  it('shows the reason when an issue has too few verified reports', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128/letter', services: await signedIn() });
    await user.click(screen.getByRole('radio', { name: 'No bin' }));
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough verified reports yet (3 of 10) for this issue in this area.');
  });

  it('asks a signed-out resident to sign in first', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128' });
    await user.click(await screen.findByRole('button', { name: 'Draft a letter about this area' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument();
  });
});
