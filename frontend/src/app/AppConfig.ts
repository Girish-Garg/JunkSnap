import { ConfigError } from '../domain/ConfigError';

export type ApiMode = 'mock' | 'live';

export interface AppEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_MODE?: string;
}

export class AppConfig {
  readonly apiMode: ApiMode;
  readonly apiUrl: string | null;

  private constructor(apiMode: ApiMode, apiUrl: string | null) {
    this.apiMode = apiMode;
    this.apiUrl = apiUrl;
  }

  static fromEnv(env: AppEnv): AppConfig {
    const apiUrl = env.VITE_API_URL?.trim().replace(/\/+$/, '') || null;
    const mode = AppConfig.#readMode(env.VITE_API_MODE?.trim() || (apiUrl ? 'live' : 'mock'));
    if (mode === 'live' && apiUrl === null) {
      throw new ConfigError('VITE_API_MODE=live needs VITE_API_URL');
    }
    return new AppConfig(mode, apiUrl);
  }

  static #readMode(value: string): ApiMode {
    if (value !== 'mock' && value !== 'live') {
      throw new ConfigError(`VITE_API_MODE must be mock or live, not "${value}"`);
    }
    return value;
  }

  requireApiUrl(): string {
    if (this.apiUrl === null) throw new ConfigError('VITE_API_URL is not set');
    return this.apiUrl;
  }
}
