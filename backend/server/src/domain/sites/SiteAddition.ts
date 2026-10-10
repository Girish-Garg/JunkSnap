import { GeoPoint } from "./GeoPoint.js";
import type { MergeableReport } from "./MergeableReport.js";
import { zoneCentre } from "./NoBinZone.js";
import type { SiteInternals, SiteProperties, SiteState } from "./SiteTypes.js";
import { earlierTime, laterTime, mergeBrands, newestPhotos, reportedBy, withItem } from "./utils.js";

// Adds one model-passed report to a site's state: its reporter, its evidence, the zone centre and a first bin reading.
export class SiteAddition {
  readonly #state: SiteState;
  readonly #report: MergeableReport;

  constructor(state: SiteState, report: MergeableReport) {
    this.#state = state;
    this.#report = report;
  }

  apply(): SiteState {
    const { feature } = this.#state;
    const internals = this.#internals();
    const properties = this.#properties();
    const [lon, lat] = feature.geometry.coordinates;
    // A no-bin zone centres on the mean of its reports' points (decision 20261010-1630); a photo site stays put.
    const centre = properties.report_type === "no_bin" ? zoneCentre(internals.reports, new GeoPoint(lat, lon)) : null;
    const geometry = centre === null ? feature.geometry : ({ type: "Point", coordinates: centre.coordinates() } as const);
    return { feature: { ...feature, geometry, properties }, internals };
  }

  #internals(): SiteInternals {
    const report = this.#report;
    const internals = this.#state.internals;
    const { reports, reporterDevices, reporterUsers, meTooCount, embeddingKey } = internals;
    const meToo = report.meTooSiteId === this.#state.feature.properties.site_id && !reportedBy(internals, report);
    const point = { lat: report.point.lat, lon: report.point.lon };
    const merged = { reportId: report.reportId, verified: false, insights: report.insights, point };
    return {
      ...internals,
      reports: [...reports, merged],
      reporterDevices: withItem(reporterDevices, report.deviceToken),
      reporterUsers: report.userId === null ? reporterUsers : withItem(reporterUsers, report.userId),
      reporterIds: withItem(internals.reporterIds, report.userId ?? report.deviceToken),
      meTooCount: meTooCount + (meToo ? 1 : 0),
      embeddingKey: embeddingKey ?? report.embeddingKey,
    };
  }

  #properties(): SiteProperties {
    const report = this.#report;
    const props = this.#state.feature.properties;
    const photos = report.photoUrl === null ? props.photo_urls : [report.photoUrl, ...props.photo_urls];
    return {
      ...props,
      report_count: props.report_count + 1,
      photo_urls: newestPhotos(photos),
      brands: mergeBrands(props.brands, report.brands),
      first_reported_at: earlierTime(props.first_reported_at, report.reportedAt),
      last_reported_at: laterTime(props.last_reported_at, report.reportedAt),
      insights: this.#binMeasured(props.insights),
    };
  }

  // A site founded before bins were measured takes the first measured reading of a report merged into it.
  #binMeasured(insights: SiteProperties["insights"]): SiteProperties["insights"] {
    const bin = this.#report.bin;
    if (insights === undefined || typeof insights.no_bin_within_3km === "boolean" || bin.no_bin_within_3km === null) {
      return insights;
    }
    return { ...insights, ...bin };
  }
}
