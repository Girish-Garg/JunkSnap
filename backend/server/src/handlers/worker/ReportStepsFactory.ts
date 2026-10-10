import { FileAssetReader } from "../../adapters/FileAssetReader.js";
import { FileMapLayerSource } from "../../adapters/FileMapLayerSource.js";
import type { PipelineStep } from "../../ports/PipelineStep.js";
import { BrandsStep } from "../../services/BrandsStep.js";
import { LocateStep } from "../../services/LocateStep.js";
import { MergeStep } from "../../services/MergeStep.js";
import { ModerateStep } from "../../services/ModerateStep.js";
import { NearPlacesFinder } from "../../services/NearPlacesFinder.js";
import { VerifyStep } from "../../services/VerifyStep.js";
import { LabellerBrandReader } from "../../services/wiring/LabellerBrandReader.js";
import { ServiceReportLocator } from "../../services/wiring/ServiceReportLocator.js";
import { ServiceReportModerator } from "../../services/wiring/ServiceReportModerator.js";
import { SiteNearbyCounter } from "../../services/wiring/SiteNearbyCounter.js";
import { SiteReportMerger } from "../../services/wiring/SiteReportMerger.js";
import { AssetSettings } from "../../settings/AssetSettings.js";
import { buildBrandLabeller } from "../buildBrandLabeller.js";
import { LocationServiceFactory } from "../LocationServiceFactory.js";
import type { WorkerDeps } from "./WorkerDeps.js";

// The report steps in order: moderate, verify (ml), brands, locate, merge into a site with nearby places.
export class ReportStepsFactory {
  readonly #deps: WorkerDeps;

  constructor(deps: WorkerDeps) {
    this.#deps = deps;
  }

  async steps(): Promise<PipelineStep[]> {
    const { context, moderation, verifier, reputation, sites } = this.#deps;
    const { settings: core, env, logger } = context;
    const [location, places] = await Promise.all([LocationServiceFactory.fromEnv(core, env).create(), this.#places()]);
    return [
      new ModerateStep(new ServiceReportModerator(moderation)),
      new VerifyStep(verifier, reputation, new SiteNearbyCounter(sites.finder())),
      new BrandsStep(new LabellerBrandReader(buildBrandLabeller({ core, env, logger }))),
      new LocateStep(new ServiceReportLocator(location)),
      new MergeStep(new SiteReportMerger(sites.merger(), places)),
    ];
  }

  async #places(): Promise<NearPlacesFinder> {
    const { assetsDir } = AssetSettings.fromEnv(this.#deps.context.env);
    const layers = await new FileMapLayerSource(new FileAssetReader(assetsDir), assetsDir).layers();
    this.#deps.context.logger.info({ layers: layers.length }, "nearby-place layers loaded");
    return new NearPlacesFinder(layers);
  }
}
