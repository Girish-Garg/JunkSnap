import type { LocationLookup, ReportUpload } from "../../contracts/index.gen.js";
import type { ReportLocator } from "../../ports/ReportLocator.js";
import type { LocationService } from "../location/LocationService.js";

export class ServiceReportLocator implements ReportLocator {
  readonly #service: LocationService;

  constructor(service: LocationService) {
    this.#service = service;
  }

  locate(gps: ReportUpload["gps"]): Promise<LocationLookup> {
    return this.#service.locate(gps.lat, gps.lon);
  }
}
