import { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import { FileAssetReader } from "../adapters/FileAssetReader.js";
import { GeoPlacesReverseGeocoder } from "../adapters/location/GeoPlacesReverseGeocoder.js";
import { LocationAssetLoader } from "../adapters/location/LocationAssetLoader.js";
import type { ReverseGeocoder } from "../ports/location/ReverseGeocoder.js";
import { LocalBodyResolver } from "../services/location/LocalBodyResolver.js";
import { LocationService } from "../services/location/LocationService.js";
import { RepresentativeDirectory } from "../services/location/RepresentativeDirectory.js";
import { SeatResolver } from "../services/location/SeatResolver.js";
import { AssetSettings } from "../settings/AssetSettings.js";
import type { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";
import { awsClientConfig } from "./utils.js";

// create() loads and indexes about 2 MB of boundaries: call it once per process and keep the service.
export class LocationServiceFactory {
  readonly #core: CoreSettings;
  readonly #assets: AssetSettings;

  constructor(core: CoreSettings, assets: AssetSettings) {
    this.#core = core;
    this.#assets = assets;
  }

  static fromEnv(core: CoreSettings, env: Env): LocationServiceFactory {
    return new LocationServiceFactory(core, AssetSettings.fromEnv(env));
  }

  async create(geocoder: ReverseGeocoder = this.#amazonLocation()): Promise<LocationService> {
    const loader = new LocationAssetLoader(new FileAssetReader(this.#assets.assetsDir));
    const [seats, bodies, rows] = await Promise.all([
      loader.loadSeats(),
      loader.loadLocalBodies(),
      loader.loadRepresentatives(),
    ]);
    return new LocationService({
      geocoder,
      seats: new SeatResolver(seats),
      localBodies: new LocalBodyResolver(bodies),
      representatives: new RepresentativeDirectory(rows),
    });
  }

  #amazonLocation(): ReverseGeocoder {
    return new GeoPlacesReverseGeocoder(new GeoPlacesClient(awsClientConfig(this.#core.awsRegion)));
  }
}
