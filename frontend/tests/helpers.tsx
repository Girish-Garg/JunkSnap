import { render, screen, within, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { AppConfig } from '../src/app/AppConfig';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { ServicesContext } from '../src/app/ServicesContext';
import type { SiteFeature } from '../src/domain/Site';
import { LanguagePreference, type KeyValueStore, type Language } from '../src/i18n/LanguagePreference';
import { Localization } from '../src/i18n/Localization';
import { LayerRegistry } from '../src/layers/LayerRegistry';
import { GeoLocator } from '../src/services/GeoLocator';
import { MockApiClient } from '../src/services/MockApiClient';
import { Sharer } from '../src/services/Sharer';
import { siteFixtureLoaders } from '../src/services/siteFixtures';

export class MemoryStore implements KeyValueStore {
  readonly #values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

export interface RenderOptions {
  readonly language?: Language;
  readonly store?: KeyValueStore;
  readonly route?: string;
}

export function testServices(store: KeyValueStore = new MemoryStore()): ServiceContainer {
  return new ServiceContainer({
    config: AppConfig.fromEnv({}),
    api: new MockApiClient(siteFixtureLoaders),
    localization: new Localization(new LanguagePreference(store)),
    layers: new LayerRegistry([]),
    locator: new GeoLocator(undefined),
    sharer: new Sharer({ clipboard: { writeText: async () => undefined } as unknown as Clipboard }),
  });
}

/** Renders inside the same providers App uses, with an in-memory router. */
export async function renderApp(ui: ReactElement, options: RenderOptions = {}): Promise<RenderResult> {
  const services = testServices(options.store);
  await services.localization.i18n.changeLanguage(options.language ?? 'en');
  return render(
    <ServicesContext.Provider value={services}>
      <I18nextProvider i18n={services.localization.i18n}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
      </I18nextProvider>
    </ServicesContext.Provider>,
  );
}

export function fixtureSite(siteId: string): Promise<SiteFeature> {
  return new MockApiClient(siteFixtureLoaders).getSite(siteId);
}

/** The value cell of the fact row labelled `label`. */
export function factValue(label: string): HTMLElement {
  const row = screen.getByText(label, { selector: 'dt' }).parentElement;
  if (!row) throw new Error(`No fact row for ${label}`);
  return within(row).getByRole('definition');
}
