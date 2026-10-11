import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { ApiError } from '../src/domain/ApiError';
import type { AreaLetterDraft, AreaLetterRequest } from '../src/domain/AreaLetter';
import type { AreaKind } from '../src/domain/AreaScores';
import type { AreaLetterApi } from '../src/services/AreaLetterApi';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { AreaLetterService } from '../src/services/AreaLetterService';
import { HttpAreaLetterApi } from '../src/services/HttpAreaLetterApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { DEVICE_TOKEN, fixedIdentity } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(areaLetterApi?: AreaLetterApi): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), areaLetterApi ? { areaLetterApi } : {});
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

// The mock api drafts any issue once the area has 10 verified reports; the real one counts the issue's own reports.
class RefusingApi implements AreaLetterApi {
  async letter(): Promise<AreaLetterDraft> {
    throw new ApiError(409, 'not_verified', 'Not enough verified reports yet (3 of 10) for this issue in this area.');
  }
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
    // Waste dumps lead on the map, but only every issue at once surely has the 10 the api needs.
    expect(await screen.findByRole('radio', { name: 'All issues 14' })).toHaveAttribute('aria-checked', 'true');
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

describe('area letter issue counts', () => {
  it('turns off an issue under 10 verified reports, and a tap says why instead of failing', async () => {
    const user = userEvent.setup();
    await renderApp(<><AppRoutes /><ToastHost /></>, { route: '/areas/assembly/s20-ac-128/letter', services: await signedIn() });
    const noBin = await screen.findByRole('radio', { name: 'No bin 3' });
    expect(noBin).toHaveAttribute('aria-disabled', 'true');
    await user.click(noBin);
    await waitFor(() => expect(document.querySelector('.app-toast')).toHaveTextContent('3 of 10 verified no-bin reports. A letter needs 10.'));
    expect(noBin).toHaveAttribute('aria-checked', 'false');
  });
});

describe('area letter refusals', () => {
  it('shows the reason the api gives, and drops it when the issue changes', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128/letter', services: await signedIn(new RefusingApi()) });
    await user.click(await screen.findByRole('radio', { name: /^Waste dumps/ }));
    await user.click(screen.getByRole('button', { name: 'Draft letter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough verified reports yet (3 of 10) for this issue in this area.');
    await user.click(screen.getByRole('radio', { name: /^All issues/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('gives the reason in Hindi in the Hindi app, with the counts the api sent', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128/letter', services: await signedIn(new RefusingApi()), language: 'hi' });
    await user.click(await screen.findByRole('radio', { name: /^कचरे के ढेर/ }));
    await user.click(screen.getByRole('button', { name: 'पत्र का मसौदा बनाएँ' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('इस इलाके में इस समस्या की अभी पर्याप्त सत्यापित रिपोर्ट नहीं (10 में से 3)।');
    expect(alert).not.toHaveTextContent(/Not enough/);
  });

  it('asks a signed-out resident to sign in first', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128' });
    await user.click(await screen.findByRole('button', { name: 'Draft a letter about this area' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument();
  });
});
