import type { Site } from "../../domain/sites/Site.js";

export interface SiteRepository {
  // Strongly consistent read by id.
  get(siteId: string): Promise<Site | null>;
  // Every site in one geohash4 cell (by-geohash GSI, all pages).
  inCell(cell: string): Promise<Site[]>;
  // False when a site with that id already exists.
  create(site: Site): Promise<boolean>;
  // Throws StaleSiteError when another writer saved the site since it was read.
  save(site: Site): Promise<void>;
}
