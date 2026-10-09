import type { SiteUsers } from "./SiteUsers.js";

// Stand-in until server-34-auth merges; sitesRoutes.ts then passes GuardedSiteUsers over RouteGuard.fromEnv.
export class GuestSiteUsers implements SiteUsers {
  async userIdOf(): Promise<null> {
    return null;
  }
}
