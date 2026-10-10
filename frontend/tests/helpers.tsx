import { render, screen, within, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { AppConfig } from '../src/app/AppConfig';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { ServicesContext } from '../src/app/ServicesContext';
import type { SiteFeature } from '../src/domain/Site';
import { AuthFlowProvider } from '../src/features/auth/components/AuthFlowProvider';
import { LanguagePreference, type KeyValueStore, type Language } from '../src/i18n/LanguagePreference';
import { Localization } from '../src/i18n/Localization';
import { LayerRegistry } from '../src/layers/LayerRegistry';
import { BoundaryCatalog } from '../src/services/BoundaryCatalog';
import { GeoLocator } from '../src/services/GeoLocator';
import { areaFixtureLoaders } from '../src/services/areaFixtures';
import { crawlFixtureLoaders } from '../src/services/crawlFixtures';
import { MockApiClient } from '../src/services/MockApiClient';
import { MockAreaApi } from '../src/services/MockAreaApi';
import { MockAuthService } from '../src/services/MockAuthService';
import { OnboardingPreference } from '../src/services/OnboardingPreference';
import { ThemePreference } from '../src/services/ThemePreference';
import { Sharer } from '../src/services/Sharer';
import { siteFixtureLoaders } from '../src/services/siteFixtures';
import { testSnapServices, type SnapTestOptions } from './snapFakes';

// The map's one areas layer, as scripts/simplify_boundaries.py lists it.
export const TEST_BOUNDARY_INDEX = { layers: { assembly: {}, loksabha: {}, areas: { fine: {} } } };

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
  readonly route?: string;
  readonly services?: ServiceContainer;
}

export function testServices(store: KeyValueStore = new MemoryStore(), snap: Partial<SnapTestOptions> = {}): ServiceContainer {
  const auth = snap.auth ?? new MockAuthService(store, 0);
  return new ServiceContainer({
    config: AppConfig.fromEnv({}),
    api: new MockApiClient(siteFixtureLoaders),
    areas: new MockAreaApi(areaFixtureLoaders, siteFixtureLoaders, crawlFixtureLoaders),
    auth,
    localization: new Localization(new LanguagePreference(store)),
    layers: new LayerRegistry([]),
    boundaries: new BoundaryCatalog('/boundaries/', async () => Response.json(TEST_BOUNDARY_INDEX)),
    locator: new GeoLocator(undefined),
    sharer: new Sharer({ clipboard: { writeText: async () => undefined } as unknown as Clipboard }),
    snap: testSnapServices({ ...snap, auth }),
    onboarding: new OnboardingPreference(store),
    theme: new ThemePreference(store, null),
  });
}

/** Renders inside the same providers App uses, with an in-memory router. */
export async function renderApp(ui: ReactElement, options: RenderOptions = {}): Promise<RenderResult> {
  const services = options.services ?? testServices();
  await services.localization.i18n.changeLanguage(options.language ?? 'en');
  return render(
    <ServicesContext.Provider value={services}>
      <I18nextProvider i18n={services.localization.i18n}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>
          <AuthFlowProvider>{ui}</AuthFlowProvider>
        </MemoryRouter>
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
