import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/** Links out of the app; each may be switched off per stage. */
export interface LinkSettings {
  /** Where the desktop "use your phone" dialog sends people for the Android app; null hides that button. */
  readonly androidAppUrl: string | null;
}

export const LINK_VARS: EnvVars<LinkSettings> = {
  androidAppUrl: Vars.link('VITE_ANDROID_APP_URL', 'https://github.com/Girish-Garg/JunkSnap/releases/latest'),
};
