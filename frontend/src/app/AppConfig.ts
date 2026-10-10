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
}

const POOL_ID = /^([a-z]{2}-[a-z]+-\d)_[A-Za-z0-9]+$/;

export class AppConfig {
  readonly apiMode: ApiMode;
  readonly apiUrl: string | null;
  /** Null signs in with the mock accounts. */
  readonly cognito: CognitoConfig | null;

  private constructor(apiMode: ApiMode, apiUrl: string | null, cognito: CognitoConfig | null) {
    this.apiMode = apiMode;
    this.apiUrl = apiUrl;
    this.cognito = cognito;
  }

  static fromEnv(env: AppEnv): AppConfig {
    const apiUrl = env.VITE_API_URL?.trim().replace(/\/+$/, '') || null;
    const mode = AppConfig.#readMode(env.VITE_API_MODE?.trim() || (apiUrl ? 'live' : 'mock'));
    if (mode === 'live' && apiUrl === null) {
      throw new ConfigError('VITE_API_MODE=live needs VITE_API_URL');
    }
    return new AppConfig(mode, apiUrl, AppConfig.#readCognito(env));
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
