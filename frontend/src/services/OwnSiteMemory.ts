import type { AuthService } from './AuthService';

/**
 * Sites the api answered 403 own_site for in this sign-in: a report from this person or this phone backs them, so
 * their votes look off at once and stay off, even when this phone never held that report (another phone, a reinstall).
 * A sign-in change (sign-out, another account) forgets them, so nobody sees what another account reported.
 */
export class OwnSiteMemory {
  readonly #listeners = new Set<() => void>();
  #sites: ReadonlySet<string> = new Set();

  /** A memory that starts empty again at every sign-in change, as ActivitySync follows them. */
  static following(auth: Pick<AuthService, 'subscribe' | 'currentUser'>): OwnSiteMemory {
    const memory = new OwnSiteMemory();
    let email = auth.currentUser()?.email ?? null;
    auth.subscribe(() => {
      const next = auth.currentUser()?.email ?? null;
      if (next === email) return;
      email = next;
      memory.#set(new Set());
    });
    return memory;
  }

  learn(siteId: string): void {
    if (!this.#sites.has(siteId)) this.#set(new Set([...this.#sites, siteId]));
  }

  /** The same set until something changes, for useSyncExternalStore. */
  sites(): ReadonlySet<string> {
    return this.#sites;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #set(sites: ReadonlySet<string>): void {
    this.#sites = sites;
    for (const listener of this.#listeners) listener();
  }
}
