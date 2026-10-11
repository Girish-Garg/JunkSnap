import { EnvReader } from './EnvReader';
import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/** How long messages stay on screen, and the start-up splash. */
export interface UiTimings {
  /** An app toast; the next in the queue follows. */
  readonly toastMs: number;
  /** The toast asking the reporter to confirm an unsure check. */
  readonly confirmToastMs: number;
  /** The toast saying a report was turned down. */
  readonly rejectionToastMs: number;
  /** "Link copied" after a share fell back to the clipboard. */
  readonly copiedMs: number;
  /** An action group stays off this long after a 429; the api's windows are an hour. */
  readonly cooldownMs: number;
  /** "2 min ago" labels tick this often while a sheet is open. */
  readonly clockTickMs: number;
  /**
   * An action waits at most this long on something still loading (the saved sign-in, this person's reports) from when
   * the sheet opens or the sign-in changes; then the api's own answer decides.
   */
  readonly checkLimitMs: number;
  /** The splash mark flies into the logo in this long (after splash.css's 800 ms of parts). */
  readonly splashFlyMs: number;
  /** With reduced motion, the still splash shows this long. */
  readonly splashStillMs: number;
}

const MINUTE_MS = 60_000;

export const UI_VARS: EnvVars<UiTimings> = {
  toastMs: Vars.ms('VITE_TOAST_MS', 4_500, MINUTE_MS),
  confirmToastMs: Vars.ms('VITE_CONFIRM_TOAST_MS', 15_000, 5 * MINUTE_MS),
  rejectionToastMs: Vars.ms('VITE_REJECTION_TOAST_MS', 12_000, 5 * MINUTE_MS),
  copiedMs: Vars.ms('VITE_COPIED_MS', 2_500, MINUTE_MS),
  cooldownMs: Vars.ms('VITE_RATE_LIMIT_COOLDOWN_MS', MINUTE_MS),
  clockTickMs: Vars.ms('VITE_CLOCK_TICK_MS', 30_000, 10 * MINUTE_MS),
  checkLimitMs: Vars.ms('VITE_CHECK_LIMIT_MS', 8_000, 5 * MINUTE_MS),
  splashFlyMs: Vars.ms('VITE_SPLASH_FLY_MS', 350, 5_000),
  splashStillMs: Vars.ms('VITE_SPLASH_STILL_MS', 450, 5_000),
};

export const UI_DEFAULTS: UiTimings = EnvReader.defaults(UI_VARS);
