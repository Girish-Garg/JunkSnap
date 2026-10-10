/** The event MainActivity.kt (AppLinks.kt) dispatches on window, with the link as `detail`. */
export const APP_LINK_EVENT = 'junksnap:applink';

/** Turns a link into an in-app route (AppLinkRoutes), or null to ignore it. */
export interface LinkRouter {
  pathFor(link: string): string | null;
}

export interface AppLinkHost {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  /** Present only inside the Android app; linkReady() asks it for a link that opened the app before the page listened. */
  readonly JunkSnapAndroid?: { linkReady?(): void };
}

/** Links that open the Android app (junksnap:// and https share links), handed to the page as routes. */
export class AppLinkListener {
  readonly #host: AppLinkHost;
  readonly #router: LinkRouter;

  constructor(host: AppLinkHost, router: LinkRouter) {
    this.#host = host;
    this.#router = router;
  }

  /** Calls `open` with the route of each link; the returned function stops listening. */
  listen(open: (path: string) => void): () => void {
    const onLink = (event: Event) => {
      const link = event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : null;
      const path = link === null ? null : this.#router.pathFor(link);
      if (path !== null) open(path);
    };
    this.#host.addEventListener(APP_LINK_EVENT, onLink);
    this.#host.JunkSnapAndroid?.linkReady?.();
    return () => this.#host.removeEventListener(APP_LINK_EVENT, onLink);
  }
}
