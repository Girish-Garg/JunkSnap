import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../src/app/AppConfig';
import { ServiceContainer } from '../src/app/ServiceContainer';
import type { SiteFeature } from '../src/domain/Site';
import { AreaShareButton } from '../src/features/areas/components/AreaShareButton';
import { LetterText } from '../src/features/letters/LetterText';
import { useShareSite } from '../src/features/site/hooks/useShareSite';
import { ShareLinks } from '../src/services/ShareLinks';
import { Sharer } from '../src/services/Sharer';
import { sampleLetterLoader } from '../src/services/siteFixtures';
import type { TFunction } from 'i18next';
import { fixtureSite, renderApp, testServices } from './helpers';

const WEB = 'https://dev.example.amplifyapp.com';

function ShareButton({ site }: { readonly site: SiteFeature }) {
  const { share, copied } = useShareSite(site);
  return <button onClick={share}>{copied ? 'copied' : 'share'}</button>;
}

function servicesWith(env: Parameters<typeof AppConfig.fromEnv>[0], writeText: (text: string) => Promise<void>) {
  const sharer = new Sharer({ clipboard: { writeText } as unknown as Clipboard });
  return new ServiceContainer({ ...testServices(), config: AppConfig.fromEnv(env), sharer });
}

async function clickShare(services: ServiceContainer) {
  const site = await fixtureSite('site_jdh_1');
  await renderApp(<ShareButton site={site} />, { services });
  await userEvent.click(screen.getByRole('button', { name: 'share' }));
}

describe('useShareSite', () => {
  afterEach(() => {
    delete (window as { __TAURI__?: unknown }).__TAURI__;
  });

  it('links to the stage web app when VITE_WEB_URL is set', async () => {
    const writeText = vi.fn(async () => undefined);
    await clickShare(servicesWith({ VITE_WEB_URL: `${WEB}/` }, writeText));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${WEB}/sites/site_jdh_1`));
    expect(await screen.findByRole('button', { name: 'copied' })).toBeInTheDocument();
  });

  it('falls back to the page origin without VITE_WEB_URL', async () => {
    const writeText = vi.fn(async () => undefined);
    await clickShare(servicesWith({}, writeText));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/sites/site_jdh_1`));
  });

  it('uses the native share sheet with the web link inside the app', async () => {
    const invoke = vi.fn(async () => undefined);
    Object.assign(window, { __TAURI__: { core: { invoke } } });
    const writeText = vi.fn(async () => undefined);
    await clickShare(servicesWith({ VITE_WEB_URL: WEB }, writeText));
    await waitFor(() => expect(invoke).toHaveBeenCalledOnce());
    expect(invoke).toHaveBeenCalledWith('plugin:sharekit|share_text', { text: expect.stringContaining(`${WEB}/sites/site_jdh_1`) });
    expect(writeText).not.toHaveBeenCalled();
  });
});

const API = 'https://d2example.cloudfront.net';
const LIVE = { VITE_API_URL: `${API}/`, VITE_API_MODE: 'live', VITE_WEB_URL: WEB };

describe('share links in live mode', () => {
  afterEach(() => {
    delete (window as { __TAURI__?: unknown }).__TAURI__;
  });

  it('shares the api link preview for a site', async () => {
    const writeText = vi.fn(async () => undefined);
    await clickShare(servicesWith(LIVE, writeText));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${API}/share/sites/site_jdh_1`));
  });

  it('sends the link preview through the Android share sheet', async () => {
    const invoke = vi.fn(async () => undefined);
    Object.assign(window, { __TAURI__: { core: { invoke } } });
    await clickShare(servicesWith(LIVE, vi.fn(async () => undefined)));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('plugin:sharekit|share_text', { text: `Waste dump ${API}/share/sites/site_jdh_1` }));
  });
});

describe('share links on the web app domain', () => {
  it('uses VITE_SHARE_URL, whose /share/* proxies to the api, instead of the api host', async () => {
    const writeText = vi.fn(async () => undefined);
    const share = 'https://junksnap.example.dev';
    await clickShare(servicesWith({ ...LIVE, VITE_SHARE_URL: `${share}/` }, writeText));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${share}/share/sites/site_jdh_1`));
  });
});

describe('ShareLinks', () => {
  it('points at the link previews when there is an api', () => {
    const links = new ShareLinks(`${API}/`, WEB);
    expect(links.site('site_jdh_1')).toBe(`${API}/share/sites/site_jdh_1`);
    expect(links.area('assembly', 's20-ac-128')).toBe(`${API}/share/areas/assembly/s20-ac-128`);
  });

  it('opens the web app directly without an api', () => {
    const links = new ShareLinks(null, `${WEB}/`);
    expect(links.site('site_jdh_1')).toBe(`${WEB}/sites/site_jdh_1`);
    expect(links.area('assembly', 's20-ac-128')).toBe(`${WEB}/areas/assembly/s20-ac-128`);
  });

  it('encodes ids', () => {
    expect(new ShareLinks(API, WEB).site('a/b?c')).toBe(`${API}/share/sites/a%2Fb%3Fc`);
  });
});

describe('AreaShareButton', () => {
  it('shares the area link preview', async () => {
    const writeText = vi.fn(async () => undefined);
    const area = { kind: 'assembly' as const, id: 's20-ac-128', name: 'Jodhpur' };
    await renderApp(<AreaShareButton area={area} />, { services: servicesWith(LIVE, writeText) });
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${API}/share/areas/assembly/s20-ac-128`));
  });
});

describe('LetterText.plain', () => {
  const t = ((key: string) => key) as unknown as TFunction;

  it('ends with the shared page link when there is one', async () => {
    const text = new LetterText(t, await sampleLetterLoader());
    expect(text.plain(`${API}/share/sites/site_jdh_1`).endsWith(`\n\nletter.link: ${API}/share/sites/site_jdh_1`)).toBe(true);
    expect(text.plain()).not.toContain('letter.link');
  });
});
