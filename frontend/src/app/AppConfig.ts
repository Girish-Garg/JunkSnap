import { CACHE_VARS, type CacheSettings } from '../config/CacheSettings';
import { CAPTURE_VARS, type CaptureSettings } from '../config/CaptureSettings';
import { EnvReader, type EnvSource, type Warn } from '../config/EnvReader';
import { LIMIT_VARS, type ListLimits } from '../config/ListLimits';
import { MAP_VARS, type MapSettings } from '../config/MapSettings';
import { NETWORK_VARS, type NetworkSettings } from '../config/NetworkSettings';
import { SITE_RULE_VARS, type SiteRules } from '../config/SiteRules';
import { UI_VARS, type UiTimings } from '../config/UiTimings';
import { ConfigError } from '../domain/ConfigError';
import { PilotCity } from '../domain/PilotCity';

export type ApiMode = 'mock' | 'live';

export interface CognitoConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly clientId: string;
}

/** Vite's import.meta.env, or a plain object of VITE_ variables in tests. */
export type AppEnv = EnvSource;

/** The tunable groups; every value has a default (src/config) and its own VITE_ variable (frontend/.env.example). */
export interface Tuning {
  readonly site: SiteRules;
  readonly map: MapSettings;
  readonly capture: CaptureSettings;
  readonly network: NetworkSettings;
  readonly cache: CacheSettings;
  readonly ui: UiTimings;
  readonly limits: ListLimits;
}

interface Endpoints {
  readonly apiMode: ApiMode;
  readonly apiUrl: string | null;
  readonly cognito: CognitoConfig | null;
  readonly webUrl: string | null;
  readonly baseUrl: string;
}

const POOL_ID = /^([a-z]{2}-[a-z]+-\d)_[A-Za-z0-9]+$/;
const consoleWarn: Warn = (message) => console.warn(message);

/**
 * Everything the build sets, read once at start-up from the VITE_ variables Vite bakes into the bundle (they are
 * public by design: never put a secret in one). Nothing else reads import.meta.env: the ServiceContainer hands these
 * values to services, and components and hooks read them with useConfig(). A parameter that defaults to a group's
 * DEFAULTS exists only so tests can leave it out; the app always passes the configured value.
 */
export class AppConfig implements Tuning {
  readonly apiMode: ApiMode;
  readonly apiUrl: string | null;
  /** Null signs in with the mock accounts. */
  readonly cognito: CognitoConfig | null;
  /** The stage's public web app; share links point here. Null shares the page's own origin. */
  readonly webUrl: string | null;
  /** Where the app is served from (Vite's BASE_URL), for the files in public/. */
  readonly baseUrl: string;
  readonly site: SiteRules;
  readonly map: MapSettings;
  readonly capture: CaptureSettings;
  readonly network: NetworkSettings;
  readonly cache: CacheSettings;
  readonly ui: UiTimings;
  readonly limits: ListLimits;
  /** The pilot city, from map.pilotCentre and map.pilotBounds. */
  readonly pilot: PilotCity;

  private constructor(endpoints: Endpoints, tuning: Tuning) {
    this.apiMode = endpoints.apiMode;
    this.apiUrl = endpoints.apiUrl;
    this.cognito = endpoints.cognito;
    this.webUrl = endpoints.webUrl;
    this.baseUrl = endpoints.baseUrl;
    this.site = tuning.site;
    this.map = tuning.map;
    this.capture = tuning.capture;
    this.network = tuning.network;
    this.cache = tuning.cache;
    this.ui = tuning.ui;
    this.limits = tuning.limits;
    this.pilot = new PilotCity(tuning.map.pilotCentre, tuning.map.pilotBounds);
  }

  /** The values this build was made with. */
  static fromBuild(): AppConfig {
    return AppConfig.fromEnv(import.meta.env);
  }

  /** Endpoints that are wrong stop the app (ConfigError); a tunable that is wrong warns and takes its default. */
  static fromEnv(env: AppEnv, warn: Warn = consoleWarn): AppConfig {
    const reader = new EnvReader(env, warn);
    return new AppConfig(AppConfig.#endpoints(reader), AppConfig.#tuning(reader));
  }

  static #endpoints(reader: EnvReader): Endpoints {
    const apiUrl = AppConfig.#baseUrl(reader.text('VITE_API_URL'));
    const apiMode = AppConfig.#readMode(reader.text('VITE_API_MODE') || (apiUrl ? 'live' : 'mock'));
    if (apiMode === 'live' && apiUrl === null) throw new ConfigError('VITE_API_MODE=live needs VITE_API_URL');
    const webUrl = AppConfig.#baseUrl(reader.text('VITE_WEB_URL'));
    return { apiMode, apiUrl, cognito: AppConfig.#readCognito(reader), webUrl, baseUrl: reader.text('BASE_URL') || '/' };
  }

  static #tuning(reader: EnvReader): Tuning {
    return {
      site: reader.group(SITE_RULE_VARS),
      map: reader.group(MAP_VARS),
      capture: reader.group(CAPTURE_VARS),
      network: reader.group(NETWORK_VARS),
      cache: reader.group(CACHE_VARS),
      ui: reader.group(UI_VARS),
      limits: reader.group(LIMIT_VARS),
    };
  }

  static #readMode(value: string): ApiMode {
    if (value !== 'mock' && value !== 'live') {
      throw new ConfigError(`VITE_API_MODE must be mock or live, not "${value}"`);
    }
    return value;
  }

  // The pool id starts with its region, e.g. ap-south-1_AbC123.
  static #readCognito(reader: EnvReader): CognitoConfig | null {
    const userPoolId = reader.text('VITE_COGNITO_USER_POOL_ID');
    const clientId = reader.text('VITE_COGNITO_CLIENT_ID');
    if (!userPoolId && !clientId) return null;
    const region = POOL_ID.exec(userPoolId)?.[1];
    if (!region || !clientId) throw new ConfigError('Set both VITE_COGNITO_USER_POOL_ID (region_id) and VITE_COGNITO_CLIENT_ID');
    return { region, userPoolId, clientId };
  }

  // A base URL without its trailing slashes; blank means not set.
  static #baseUrl(value: string): string | null {
    return value.replace(/\/+$/, '') || null;
  }

  /** Mock mode shows fixtures, so the UI labels them as sample data. */
  isSampleData(): boolean {
    return this.apiMode === 'mock';
  }

  requireApiUrl(): string {
    if (this.apiUrl === null) throw new ConfigError('VITE_API_URL is not set');
    return this.apiUrl;
  }

  /** An absolute URL for a file the app serves from public/ (a path under baseUrl), so workers can fetch it too. */
  assetUrl(path: string, pageUrl: string): string {
    return new URL(`${this.baseUrl}${path}`, pageUrl).href;
  }
}
