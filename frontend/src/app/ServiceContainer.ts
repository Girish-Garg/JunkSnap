import { LanguagePreference, type KeyValueStore } from '../i18n/LanguagePreference';
import { Localization } from '../i18n/Localization';
import { LayerRegistry } from '../layers/LayerRegistry';
import type { ApiClient } from '../services/ApiClient';
import type { AuthService } from '../services/AuthService';
import { GeoLocator } from '../services/GeoLocator';
import { HttpApiClient } from '../services/HttpApiClient';
import { MockApiClient } from '../services/MockApiClient';
import { MockAuthService } from '../services/MockAuthService';
import { Sharer, type ShareApi } from '../services/Sharer';
import { siteFixtureLoaders } from '../services/siteFixtures';
import type { ApiMode, AppConfig } from './AppConfig';

// A new API mode is a new entry here, not a new branch.
const API_CLIENT_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig) => ApiClient>> = {
  mock: () => new MockApiClient(siteFixtureLoaders),
  live: (config) => new HttpApiClient(config.requireApiUrl()),
};

export interface BrowserApis {
  readonly store: KeyValueStore;
  readonly geolocation: Geolocation | undefined;
  readonly share: ShareApi;
}

export interface Services {
  readonly config: AppConfig;
  readonly api: ApiClient;
  readonly auth: AuthService;
  readonly localization: Localization;
  readonly layers: LayerRegistry;
  readonly locator: GeoLocator;
  readonly sharer: Sharer;
}

/** Composition root: the only place that builds services. */
export class ServiceContainer implements Services {
  readonly config: AppConfig;
  readonly api: ApiClient;
  readonly auth: AuthService;
  readonly localization: Localization;
  readonly layers: LayerRegistry;
  readonly locator: GeoLocator;
  readonly sharer: Sharer;

  constructor(services: Services) {
    this.config = services.config;
    this.api = services.api;
    this.auth = services.auth;
    this.localization = services.localization;
    this.layers = services.layers;
    this.locator = services.locator;
    this.sharer = services.sharer;
  }

  // Auth is the mock in both modes until the Cognito adapter lands.
  static build(config: AppConfig, browser: BrowserApis): ServiceContainer {
    return new ServiceContainer({
      config,
      api: API_CLIENT_BUILDERS[config.apiMode](config),
      auth: new MockAuthService(browser.store),
      localization: new Localization(new LanguagePreference(browser.store)),
      layers: new LayerRegistry(),
      locator: new GeoLocator(browser.geolocation),
      sharer: new Sharer(browser.share),
    });
  }
}
