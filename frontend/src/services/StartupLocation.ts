import { LocationError } from '../domain/LocationError';
import type { LonLat } from '../domain/Site';
import type { GeoLocator } from './GeoLocator';
import type { LocationAccess, LocationAnswer } from './LocationAccess';
import { StoredFlag } from './StoredFlag';

/** Session storage: the start-up fix ran in this launch. */
export const STARTUP_LOCATION_KEY = 'junksnap.locationAsk';
/** Local storage: the person refused location, so the start never asks again until it is allowed. */
export const LOCATION_REFUSED_KEY = 'junksnap.locationRefused';

/** The part of GeoLocator the start-up fix uses. */
export type StartupLocator = Pick<GeoLocator, 'canLocate' | 'locate'>;

/** What the start-up fix remembers: that it ran in this launch, and a refusal across launches. */
export interface StartupMarks {
  readonly launch: StoredFlag;
  readonly refused: StoredFlag;
}

/**
 * Takes one fix per launch, once the start screens are out of the way. Allowed (the browser's or Android's own
 * answer): a quiet fix, which cannot prompt. Not decided yet: the browser's prompt or Android's dialog, unless the
 * person refused before; Android's checkLocation cannot tell never asked from refused, so a refusal (at start or on
 * a tap) is kept until location is allowed. Blocked: nothing. A denial shows nothing at start (a tile's tap explains
 * how to allow it). The answer teaches LocationAccess, so the distance tiles are right from the start; a fix is kept
 * for the map, which shows it but never moves to it by itself. Blocked storage keeps no marks: it asks each launch.
 */
export class StartupLocation {
  readonly #locator: StartupLocator;
  readonly #access: LocationAccess;
  readonly #marks: StartupMarks;
  readonly #enabled: boolean;
  readonly #listeners = new Set<() => void>();
  #started = false;
  #fix: LonLat | null = null;

  constructor(locator: StartupLocator, access: LocationAccess, marks: StartupMarks, enabled: boolean) {
    this.#locator = locator;
    this.#access = access;
    this.#marks = marks;
    this.#enabled = enabled;
    access.subscribe(() => this.#remember(access.answer()));
  }

  /** The marks in the page's storage: the launch in session storage, a refusal in local storage. */
  static marks(session: () => Storage, local: () => Storage): StartupMarks {
    return { launch: new StoredFlag(STARTUP_LOCATION_KEY, session), refused: new StoredFlag(LOCATION_REFUSED_KEY, local) };
  }

  /** The fix taken at start, or null. */
  fix(): LonLat | null {
    return this.#fix;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Runs once per launch (later calls do nothing); reads the permission first. */
  async locateOnce(): Promise<void> {
    if (!this.#due()) return;
    this.#started = true;
    this.#marks.launch.set();
    await this.#access.refresh();
    if (this.#wanted(this.#access.answer())) await this.#locate();
  }

  #due(): boolean {
    return this.#enabled && !this.#started && !this.#marks.launch.isSet() && this.#locator.canLocate();
  }

  // Allowed: always (it cannot prompt). Blocked: never. Undecided: unless the person refused before.
  #wanted(answer: LocationAnswer): boolean {
    if (answer === 'granted') return true;
    return answer !== 'denied' && !this.#marks.refused.isSet();
  }

  // Whatever told LocationAccess (checkLocation, the browser, a fix or a denial on a tap): allowed forgets a refusal.
  #remember(answer: LocationAnswer): void {
    if (answer === 'granted') this.#marks.refused.clear();
    if (answer === 'denied') this.#marks.refused.set();
  }

  // GeoLocator's one path: an allowed request answers at once; an undecided one shows the browser's prompt, or
  // Android's permission dialog through the app's PermissionChromeClient.
  async #locate(): Promise<void> {
    try {
      const fix = await this.#locator.locate();
      this.#access.learn('granted');
      this.#fix = fix;
      for (const listener of this.#listeners) listener();
    } catch (error) {
      this.#access.learn(error instanceof LocationError ? error.problem : 'unavailable');
    }
  }
}
