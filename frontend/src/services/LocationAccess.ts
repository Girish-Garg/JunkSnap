import type { LocationProblem } from '../domain/LocationError';

/** granted, denied or prompt; unknown until something tells. */
export type LocationAnswer = PermissionState | 'unknown';

/** Where LocationAccess reads whether location is allowed; null when this source cannot tell. */
export interface LocationPermissionSource {
  read(): Promise<PermissionState | null>;
  /** Calls onChange whenever the answer may have changed; the returned function stops. */
  watch(onChange: () => void): () => void;
}

/**
 * Whether this person allowed location, for the distance gates: what the source says, and what the last request for
 * a fix showed. A browser without the Permissions API, and the Android app, mostly learn it the second way.
 */
export class LocationAccess {
  readonly #source: LocationPermissionSource;
  readonly #listeners = new Set<() => void>();
  #answer: LocationAnswer = 'unknown';

  constructor(source: LocationPermissionSource) {
    this.#source = source;
  }

  answer(): LocationAnswer {
    return this.#answer;
  }

  /** Reads the source again, e.g. when the person comes back from the settings. */
  async refresh(): Promise<void> {
    const read = await this.#source.read();
    if (read !== null) this.#set(read);
  }

  /** Reads the source again whenever it says the answer changed; the returned function stops. */
  watch(): () => void {
    return this.#source.watch(() => void this.refresh());
  }

  /** A fix means allowed and a denial means blocked; location off or slow says nothing about the permission. */
  learn(outcome: 'granted' | LocationProblem): void {
    if (outcome === 'granted' || outcome === 'denied') this.#set(outcome);
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #set(answer: LocationAnswer): void {
    if (answer === this.#answer) return;
    this.#answer = answer;
    for (const listener of this.#listeners) listener();
  }
}
