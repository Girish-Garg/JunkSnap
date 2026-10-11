import { AppConfig } from '../src/app/AppConfig';

/** The app's configuration with no VITE_ variable set: every tunable at its default, as the app runs by default. */
export const DEFAULTS = AppConfig.fromEnv({});
