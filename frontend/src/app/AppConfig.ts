import { ConfigError } from '../domain/ConfigError';

export type ApiMode = 'mock' | 'live';

export interface CognitoConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly clientId: string;
}

export interface AppEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_MODE?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_WEB_URL?: string;
  readonly VITE_SHARE_URL?: string;
}

interface SiteUrls {
  readonly webUrl: string | null;
  readonly shareUrl: string | null;
}

const POOL_ID = /^([a-z]{2}-[a-z]+-\d)_[A-Za-z0-9]+$/;

export class AppConfig {
  readonly apiMode: ApiMode;
  readonly apiUrl: string | null;
  /** Null signs in with the mock accounts. */
  readonly cognito: CognitoConfig | null;
  /** The stage's public web app; share links point here. Null shares the page's own origin. */
  readonly webUrl: string | null;
  /** Where share links (/share/*) point: a host serving the api's link previews. Null uses the api itself. */
  readonly shareUrl: string | null;

  private constructor(apiMode: ApiMode, apiUrl: string | null, cognito: CognitoConfig | null, urls: SiteUrls) {
    this.apiMode = apiMode;
    this.apiUrl = apiUrl;
    this.cognito = cognito;
    this.webUrl = urls.webUrl;
    this.shareUrl = urls.shareUrl;
  }

  static fromEnv(env: AppEnv): AppConfig {
    const apiUrl = AppConfig.#baseUrl(env.VITE_API_URL);
    const mode = AppConfig.#readMode(env.VITE_API_MODE?.trim() || (apiUrl ? 'live' : 'mock'));
    if (mode === 'live' && apiUrl === null) {
      throw new ConfigError('VITE_API_MODE=live needs VITE_API_URL');
    }
    const urls = { webUrl: AppConfig.#url(env.VITE_WEB_URL), shareUrl: AppConfig.#url(env.VITE_SHARE_URL) };
    return new AppConfig(mode, apiUrl, AppConfig.#readCognito(env), urls);
  }

  static #url(value: string | undefined): string | null {
    return value?.trim().replace(/\/+$/, '') || null;
  }

  static #readMode(value: string): ApiMode {
    if (value !== 'mock' && value !== 'live') {
      throw new ConfigError(`VITE_API_MODE must be mock or live, not "${value}"`);
    }
    return value;
  }

  // The pool id starts with its region, e.g. ap-south-1_AbC123.
  static #readCognito(env: AppEnv): CognitoConfig | null {
    const userPoolId = AppConfig.#trimmed(env.VITE_COGNITO_USER_POOL_ID);
    const clientId = AppConfig.#trimmed(env.VITE_COGNITO_CLIENT_ID);
    if (!userPoolId && !clientId) return null;
    const region = POOL_ID.exec(userPoolId)?.[1];
    if (!region || !clientId) throw new ConfigError('Set both VITE_COGNITO_USER_POOL_ID (region_id) and VITE_COGNITO_CLIENT_ID');
    return { region, userPoolId, clientId };
  }

  // A base URL without its trailing slashes; blank means not set.
  static #baseUrl(value: string | undefined): string | null {
    return value?.trim().replace(/\/+$/, '') || null;
  }

  static #trimmed(value: string | undefined): string {
    return value?.trim() ?? '';
  }

  /** Mock mode shows fixtures, so the UI labels them as sample data. */
  isSampleData(): boolean {
    return this.apiMode === 'mock';
  }

  requireApiUrl(): string {
    if (this.apiUrl === null) throw new ConfigError('VITE_API_URL is not set');
    return this.apiUrl;
  }
}
