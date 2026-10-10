import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../src/app/AppConfig';
import { ServiceContainer } from '../src/app/ServiceContainer';
import type { SiteFeature } from '../src/domain/Site';
import { useShareSite } from '../src/features/site/hooks/useShareSite';
import { Sharer } from '../src/services/Sharer';
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
