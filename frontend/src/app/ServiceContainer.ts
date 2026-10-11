import { LanguagePreference, type KeyValueStore } from '../i18n/LanguagePreference';
import { CopyNumbers } from '../i18n/CopyNumbers';
import { Localization } from '../i18n/Localization';
import { LayerRegistry } from '../layers/LayerRegistry';
import type { ApiClient } from '../services/ApiClient';
import type { AreaApi } from '../services/AreaApi';
import type { TaggedAreaApi } from '../services/TaggedAreaApi';
import { areaFixtureLoaders } from '../services/areaFixtures';
import { AmplifyAuthFactory } from '../services/AmplifyAuthFactory';
import { BoundaryCatalog } from '../services/BoundaryCatalog';
import type { AuthService } from '../services/AuthService';
import { crawlFixtureLoaders } from '../services/crawlFixtures';
import { GeoLocator, type PermissionQuery } from '../services/GeoLocator';
import { AppLocationPermission, type AppLocationHost } from '../services/AppLocationPermission';
import { BrowserLocationPermission } from '../services/BrowserLocationPermission';
import { LocationAccess, type LocationPermissionSource } from '../services/LocationAccess';
import { NativeBridge, type NativeHost } from '../services/NativeBridge';
import { HttpApiClient } from '../services/HttpApiClient';
import { CachedAreaApi } from '../services/CachedAreaApi';
import { ExpiringCache } from '../services/ExpiringCache';
import { SiteCaches } from '../services/SiteCaches';
import { SystemClock } from '../services/SystemClock';
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
import { ActionCooldowns } from '../services/ActionCooldowns';
import { OwnSiteMemory } from '../services/OwnSiteMemory';
import { ErrorReporter } from '../services/ErrorReporter';
import { Notifier } from '../services/Notifier';
import { WINDOW_TIMER } from '../services/Timer';
import { UnavailableAuthService } from '../services/UnavailableAuthService';
import { siteFixtureLoaders } from '../services/siteFixtures';
import type { ApiMode, AppConfig } from './AppConfig';
import { SnapServiceFactory, type SnapBrowserApis } from './SnapServiceFactory';
import type { SnapServices } from './SnapServices';

// A new API mode is a new entry here, not a new branch.
const API_CLIENT_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig, caches: SiteCaches) => ApiClient>> = {
  mock: () => new MockApiClient(siteFixtureLoaders),
  live: (config, caches) => new HttpApiClient(config.requireApiUrl(), undefined, caches, config.network.requestTimeoutMs),
};

const AREA_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig) => TaggedAreaApi>> = {
  mock: () => new MockAreaApi(areaFixtureLoaders, siteFixtureLoaders, crawlFixtureLoaders),
  live: (config) => new HttpAreaApi(config.requireApiUrl(), undefined, config.network.requestTimeoutMs),
};

// The mock signs anyone in, so it only runs with sample data; live mode signs in with Cognito.
const AUTH_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig, store: KeyValueStore) => AuthService>> = {
  mock: (config, store) => new MockAuthService(store, config.network.mockDelayMs),
  live: (config) => (config.cognito ? AmplifyAuthFactory.build(config.cognito) : new UnavailableAuthService()),
};

export interface BrowserApis extends SnapBrowserApis {
  readonly store: KeyValueStore;
  readonly share: ShareApi;
  /** The element that carries data-theme; absent in tests. */
  readonly root?: HTMLElement;
  /** Lets the map read a location fix on open only when location is already allowed. */
  readonly permissions?: PermissionQuery;
  /** The page's window: inside the Android app, location access is read from the app, not the WebView. */
  readonly host?: NativeHost & AppLocationHost;
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
  /** App-wide toasts, error reports and rate-limit memory; built here when not given (tests leave them out). */
  readonly notifier?: Notifier;
  readonly errors?: ErrorReporter;
  readonly cooldowns?: ActionCooldowns;
  /** Sites the api answered 403 own_site for in this sign-in. */
  readonly ownSites?: OwnSiteMemory;
  /** Whether location is allowed, for the distance gates; tests without one read no Permissions API. */
  readonly locationAccess?: LocationAccess;
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
  readonly notifier: Notifier;
  readonly errors: ErrorReporter;
  readonly cooldowns: ActionCooldowns;
  readonly ownSites: OwnSiteMemory;
  readonly locationAccess: LocationAccess;

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
    this.notifier = services.notifier ?? new Notifier();
    this.errors = services.errors ?? new ErrorReporter(console, () => navigator.onLine);
    this.cooldowns = services.cooldowns ?? new ActionCooldowns(WINDOW_TIMER, () => Date.now(), services.config.ui.cooldownMs);
    this.ownSites = services.ownSites ?? OwnSiteMemory.following(services.auth);
    this.locationAccess = services.locationAccess ?? new LocationAccess(new BrowserLocationPermission(undefined));
  }

  static build(config: AppConfig, browser: BrowserApis): ServiceContainer {
    const auth = AUTH_BUILDERS[config.apiMode](config, browser.store);
    const clock = new SystemClock();
    // One set of site copies: the api reads into it, and site actions forget a site after writing to it.
    const siteCaches = SiteCaches.standard(clock, config.cache);
    return new ServiceContainer({
      config,
      api: API_CLIENT_BUILDERS[config.apiMode](config, siteCaches),
      areas: new CachedAreaApi(AREA_BUILDERS[config.apiMode](config), new ExpiringCache(CachedAreaApi.policy(config.cache), clock)),
      auth,
      localization: new Localization(new LanguagePreference(browser.store), CopyNumbers.of(config.site)),
      ...ServiceContainer.#map(config, clock),
      locator: new GeoLocator(browser.geolocation, browser.permissions, config.capture),
      sharer: new Sharer(browser.share),
      snap: SnapServiceFactory.build(config, browser, auth, siteCaches),
      onboarding: new OnboardingPreference(browser.store),
      theme: new ThemePreference(browser.store, browser.root ?? null),
      edge: ServiceContainer.#edge(browser, config),
      locationAccess: new LocationAccess(ServiceContainer.#locationSource(browser)),
    });
  }

  // The map's layers (a no-bin zone's circle) and the boundary files under the app's base URL.
  static #map(config: AppConfig, clock: SystemClock): Pick<Services, 'layers' | 'boundaries'> {
    const zones = { zoneRadiusM: config.site.zoneRadiusM, latitude: config.map.pilotCentre[1] };
    const folder = config.assetUrl(config.map.boundariesPath, globalThis.location.href);
    return {
      layers: new LayerRegistry(undefined, zones),
      boundaries: new BoundaryCatalog(folder, undefined, BoundaryCatalog.caches(clock, config.cache.boundaryIndexTtlMs)),
    };
  }

  // The Android app's WebView never reports the app's location permission, so the app is asked there.
  static #locationSource(browser: BrowserApis): LocationPermissionSource {
    const host = browser.host;
    if (host && new NativeBridge(host).inApp()) return new AppLocationPermission(host);
    return new BrowserLocationPermission(browser.permissions);
  }

  // The startup probe runs here, once; it only reads what the browser offers and downloads nothing.
  static #edge(browser: BrowserApis, config: AppConfig): EdgeHints {
    const probe = new CapabilityProbe(browser.edge?.capabilities ?? CapabilityProbe.NONE, config.capture);
    return new EdgeHints(probe, new EdgeHintsPreference(browser.store), browser.edge?.detector ?? NO_DETECTOR);
  }
}
