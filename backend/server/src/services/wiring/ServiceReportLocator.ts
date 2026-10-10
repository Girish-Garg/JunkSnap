import type { LocationLookup } from "../../contracts/index.gen.js";
import type { LatLon, ReportLocator } from "../../ports/ReportLocator.js";
import type { LocationService } from "../location/LocationService.js";

export class ServiceReportLocator implements ReportLocator {
  readonly #service: LocationService;

  constructor(service: LocationService) {
    this.#service = service;
  }

  locate(point: LatLon): Promise<LocationLookup> {
    return this.#service.locate(point.lat, point.lon);
  }
}
