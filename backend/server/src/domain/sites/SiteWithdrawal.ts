import { GeoPoint } from "./GeoPoint.js";
import { zoneCentre } from "./NoBinZone.js";
import type { MergedReport, SiteFeature, SiteInternals, SiteProperties, SiteState } from "./SiteTypes.js";
import { earlierTime, laterTime, mergeBrands, newestPhotos, personOf } from "./utils.js";
import type { SiteReportRef, Withdrawal } from "./Withdrawal.js";

// Decision 20261010-1700: takes the caller's reports out of a site's state; with none left the site is removed.
// Me-too counts are not per report, so corroborations may stay one too high after a me-too report is withdrawn.
export class SiteWithdrawal {
  readonly #state: SiteState;
  readonly #request: Withdrawal;
  readonly #mine: ReadonlySet<string>;

  constructor(state: SiteState, request: Withdrawal) {
    this.#state = state;
    this.#request = request;
    this.#mine = new Set(request.mine.map((report) => report.reportId));
  }

  // The caller's reports that are still counted on the site.
  withdrawnIds(): string[] {
    return this.#state.internals.reports.filter((report) => this.#mine.has(report.reportId)).map((report) => report.reportId);
  }

  apply(): SiteState {
    const { feature, internals } = this.#state;
    const withdrawn = this.withdrawnIds();
    const reports = internals.reports.filter((report) => !this.#mine.has(report.reportId));
    const audit = { ...internals, withdrawnReports: [...internals.withdrawnReports, ...withdrawn] };
    if (reports.length === 0) {
      const removed = { status: "removed", removed_reason: "withdrawn", removed_at: this.#request.at } as const;
      const internalsLeft = { ...audit, ...this.#reporters(internals), reports };
      return { feature: { ...feature, properties: { ...feature.properties, ...removed } }, internals: internalsLeft };
    }
    const geometry = SiteWithdrawal.#geometry(feature, reports);
    const properties = this.#properties(feature.properties, withdrawn.length);
    return { feature: { ...feature, geometry, properties }, internals: { ...audit, ...this.#reporters(internals), reports } };
  }

  // A no-bin zone re-centres on the reports that stay (decision 20261010-1630); a photo site stays on the waste.
  static #geometry(feature: SiteFeature, reports: readonly MergedReport[]): SiteFeature["geometry"] {
    if (feature.properties.report_type !== "no_bin") {
      return feature.geometry;
    }
    const [lon, lat] = feature.geometry.coordinates;
    return { type: "Point", coordinates: zoneCentre(reports, new GeoPoint(lat, lon)).coordinates() };
  }

  // Counts and photos always; brands and dates only when every report that stays has a known row.
  #properties(props: SiteProperties, withdrawn: number): SiteProperties {
    const dropped = new Set(this.#request.mine.map((report) => report.photoUrl));
    const counted = {
      ...props,
      report_count: Math.max(1, props.report_count - withdrawn),
      photo_urls: newestPhotos(props.photo_urls.filter((url) => !dropped.has(url))),
    };
    if (!this.#complete()) {
      return counted;
    }
    const stay = this.#stay();
    const times = stay.map((report) => report.reportedAt);
    return {
      ...counted,
      brands: mergeBrands([], stay.flatMap((report) => report.brands)),
      first_reported_at: times.reduce(earlierTime, times[0] ?? props.first_reported_at),
      last_reported_at: times.reduce(laterTime, times[0] ?? props.last_reported_at),
    };
  }

  // False while a report that stays has no row in the by-site index yet: it may hold any reporter, brand or date.
  #complete(): boolean {
    const known = new Set(this.#request.others.map((report) => report.reportId));
    return this.#state.internals.reports.every((report) => this.#mine.has(report.reportId) || known.has(report.reportId));
  }

  // A device, user or person leaves the reporters unless another report that stays is theirs too, or might be.
  #reporters(internals: SiteInternals): Pick<SiteInternals, "reporterDevices" | "reporterUsers" | "reporterIds"> {
    const { mine } = this.#request;
    if (!this.#complete()) {
      const { reporterDevices, reporterUsers, reporterIds } = internals;
      return { reporterDevices, reporterUsers, reporterIds };
    }
    const stay = this.#stay();
    const keep = (ids: readonly string[], of: (report: SiteReportRef) => string | null) => {
      const leaving = new Set(mine.map(of).filter((id) => !stay.some((report) => of(report) === id)));
      return ids.filter((id) => !leaving.has(id));
    };
    return {
      reporterDevices: keep(internals.reporterDevices, (report) => report.deviceToken),
      reporterUsers: keep(internals.reporterUsers, (report) => report.userId),
      reporterIds: keep(internals.reporterIds, personOf),
    };
  }

  #stay(): SiteReportRef[] {
    const counted = new Set(this.#state.internals.reports.map((report) => report.reportId));
    return this.#request.others.filter((report) => counted.has(report.reportId) && !this.#mine.has(report.reportId));
  }
}
