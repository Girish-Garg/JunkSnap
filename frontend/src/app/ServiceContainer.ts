import { LanguagePreference, type KeyValueStore } from '../i18n/LanguagePreference';
import { Localization } from '../i18n/Localization';
import { LayerRegistry } from '../layers/LayerRegistry';
import type { ApiClient } from '../services/ApiClient';
import type { AreaApi } from '../services/AreaApi';
import { areaFixtureLoaders } from '../services/areaFixtures';
import { AmplifyAuthFactory } from '../services/AmplifyAuthFactory';
import { BoundaryCatalog } from '../services/BoundaryCatalog';
import type { AuthService } from '../services/AuthService';
import { crawlFixtureLoaders } from '../services/crawlFixtures';
import { GeoLocator, type PermissionQuery } from '../services/GeoLocator';
import { HttpApiClient } from '../services/HttpApiClient';
import { CachedAreaApi } from '../services/CachedAreaApi';
import { HttpAreaApi } from '../services/HttpAreaApi';
import { MockApiClient } from '../services/MockApiClient';
import { MockAreaApi } from '../services/MockAreaApi';
import { MockAuthService } from '../services/MockAuthService';
import { OnboardingPreference } from '../services/OnboardingPreference';
import { ThemePreference } from '../services/ThemePreference';
import { CapabilityProbe, type DeviceCapabilities } from '../services/CapabilityProbe';
import { EdgeHints, type DetectorFactory } from '../services/EdgeHints';
import { EdgeHintsPreference } from '../services/EdgeHintsPreference';
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

const AREA_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig) => AreaApi>> = {
  mock: () => new MockAreaApi(areaFixtureLoaders, siteFixtureLoaders, crawlFixtureLoaders),
  live: (config) => new HttpAreaApi(config.requireApiUrl()),
};

// The mock signs anyone in, so it only runs with sample data; live mode signs in with Cognito.
const AUTH_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig, store: KeyValueStore) => AuthService>> = {
  mock: (_config, store) => new MockAuthService(store),
  live: (config) => (config.cognito ? AmplifyAuthFactory.build(config.cognito) : new UnavailableAuthService()),
};

export interface BrowserApis extends SnapBrowserApis {
  readonly store: KeyValueStore;
  readonly share: ShareApi;
  /** The element that carries data-theme; absent in tests. */
  readonly root?: HTMLElement;
  /** Lets the map read a location fix on open only when location is already allowed. */
  readonly permissions?: PermissionQuery;
  /** What the startup probe reads and how to build the detector; absent means cloud mode. */
  readonly edge?: EdgeEnvironment;
}

export interface EdgeEnvironment {
  readonly capabilities: DeviceCapabilities;
  readonly detector: DetectorFactory;
}

const NO_DETECTOR: DetectorFactory = () => {
  throw new Error('No on-device detector in this environment');
};

export interface Services {
  readonly config: AppConfig;
  readonly api: ApiClient;
  readonly areas: AreaApi;
  readonly auth: AuthService;
  readonly localization: Localization;
  readonly layers: LayerRegistry;
  readonly boundaries: BoundaryCatalog;
  readonly locator: GeoLocator;
  readonly sharer: Sharer;
  readonly snap: SnapServices;
  readonly onboarding: OnboardingPreference;
  readonly theme: ThemePreference;
  readonly edge: EdgeHints;
}

/** Composition root: the only place that builds services. */
export class ServiceContainer implements Services {
  readonly config: AppConfig;
  readonly api: ApiClient;
  readonly areas: AreaApi;
  readonly auth: AuthService;
  readonly localization: Localization;
  readonly layers: LayerRegistry;
  readonly boundaries: BoundaryCatalog;
  readonly locator: GeoLocator;
  readonly sharer: Sharer;
  readonly snap: SnapServices;
  readonly onboarding: OnboardingPreference;
  readonly theme: ThemePreference;
  readonly edge: EdgeHints;

  constructor(services: Services) {
    this.config = services.config;
    this.api = services.api;
    this.areas = services.areas;
    this.auth = services.auth;
    this.localization = services.localization;
    this.layers = services.layers;
    this.boundaries = services.boundaries;
    this.locator = services.locator;
    this.sharer = services.sharer;
    this.snap = services.snap;
    this.onboarding = services.onboarding;
    this.theme = services.theme;
    this.edge = services.edge;
  }

  static build(config: AppConfig, browser: BrowserApis): ServiceContainer {
    const auth = AUTH_BUILDERS[config.apiMode](config, browser.store);
    return new ServiceContainer({
      config,
      api: API_CLIENT_BUILDERS[config.apiMode](config),
      areas: new CachedAreaApi(AREA_BUILDERS[config.apiMode](config)),
      auth,
      localization: new Localization(new LanguagePreference(browser.store)),
      layers: new LayerRegistry(),
      boundaries: new BoundaryCatalog(BoundaryCatalog.defaultBaseUrl()),
      locator: new GeoLocator(browser.geolocation, browser.permissions),
      sharer: new Sharer(browser.share),
      snap: SnapServiceFactory.build(config, browser, auth),
      onboarding: new OnboardingPreference(browser.store),
      theme: new ThemePreference(browser.store, browser.root ?? null),
      edge: ServiceContainer.#edge(browser),
    });
  }

  // The startup probe runs here, once; it only reads what the browser offers and downloads nothing.
  static #edge(browser: BrowserApis): EdgeHints {
    const probe = new CapabilityProbe(browser.edge?.capabilities ?? CapabilityProbe.NONE);
    return new EdgeHints(probe, new EdgeHintsPreference(browser.store), browser.edge?.detector ?? NO_DETECTOR);
  }
}
