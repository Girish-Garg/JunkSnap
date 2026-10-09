import { LanguagePreference, type KeyValueStore } from '../i18n/LanguagePreference';
import { Localization } from '../i18n/Localization';
import { LayerRegistry } from '../layers/LayerRegistry';
import type { ApiClient } from '../services/ApiClient';
import { AmplifyAuthFactory } from '../services/AmplifyAuthFactory';
import type { AuthService } from '../services/AuthService';
import { GeoLocator } from '../services/GeoLocator';
import { HttpApiClient } from '../services/HttpApiClient';
import { MockApiClient } from '../services/MockApiClient';
import { MockAuthService } from '../services/MockAuthService';
import { Sharer, type ShareApi } from '../services/Sharer';
import { UnavailableAuthService } from '../services/UnavailableAuthService';
import { siteFixtureLoaders } from '../services/siteFixtures';
import type { ApiMode, AppConfig } from './AppConfig';
import { SnapServiceFactory, type SnapBrowserApis } from './SnapServiceFactory';
import type { SnapServices } from './SnapServices';

// A new API mode is a new entry here, not a new branch.
const API_CLIENT_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig) => ApiClient>> = {
  mock: () => new MockApiClient(siteFixtureLoaders),
  live: (config) => new HttpApiClient(config.requireApiUrl()),
};

// The mock signs anyone in, so it only runs with sample data; live mode signs in with Cognito.
const AUTH_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig, store: KeyValueStore) => AuthService>> = {
  mock: (_config, store) => new MockAuthService(store),
  live: (config) => (config.cognito ? AmplifyAuthFactory.build(config.cognito) : new UnavailableAuthService()),
};

export interface BrowserApis extends SnapBrowserApis {
  readonly store: KeyValueStore;
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
  readonly snap: SnapServices;
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
  readonly snap: SnapServices;

  constructor(services: Services) {
    this.config = services.config;
    this.api = services.api;
    this.auth = services.auth;
    this.localization = services.localization;
    this.layers = services.layers;
    this.locator = services.locator;
    this.sharer = services.sharer;
    this.snap = services.snap;
  }

  static build(config: AppConfig, browser: BrowserApis): ServiceContainer {
    const auth = AUTH_BUILDERS[config.apiMode](config, browser.store);
    return new ServiceContainer({
      config,
      api: API_CLIENT_BUILDERS[config.apiMode](config),
      auth,
      localization: new Localization(new LanguagePreference(browser.store)),
      layers: new LayerRegistry(),
      locator: new GeoLocator(browser.geolocation),
      sharer: new Sharer(browser.share),
      snap: SnapServiceFactory.build(config, browser, auth),
    });
  }
}
