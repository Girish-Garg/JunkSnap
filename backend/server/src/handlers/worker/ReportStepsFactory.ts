import { DisabledCrawlActivator } from "../../adapters/DisabledCrawlActivator.js";
import { DynamoCrawlActivator } from "../../adapters/DynamoCrawlActivator.js";
import { FileAssetReader } from "../../adapters/FileAssetReader.js";
import { FileBinSource } from "../../adapters/FileBinSource.js";
import { FileMapLayerSource } from "../../adapters/FileMapLayerSource.js";
import { AwsCalls } from "../../adapters/sites/AwsCalls.js";
import { SystemClock } from "../../adapters/SystemClock.js";
import type { Report } from "../../domain/Report.js";
import type { CrawlActivator } from "../../ports/CrawlActivator.js";
import type { PipelineStep } from "../../ports/PipelineStep.js";
import type { ReportMerger } from "../../ports/ReportMerger.js";
import { BinLocator } from "../../services/BinLocator.js";
import { BrandsStep } from "../../services/BrandsStep.js";
import { ConditionalStep } from "../../services/ConditionalStep.js";
import { LocateStep } from "../../services/LocateStep.js";
import { MergeStep } from "../../services/MergeStep.js";
import { ModerateStep } from "../../services/ModerateStep.js";
import { NearPlacesFinder } from "../../services/NearPlacesFinder.js";
import { VerifyStep } from "../../services/VerifyStep.js";
import { ActivatingReportMerger } from "../../services/wiring/ActivatingReportMerger.js";
import { LabellerBrandReader } from "../../services/wiring/LabellerBrandReader.js";
import { ServiceReportLocator } from "../../services/wiring/ServiceReportLocator.js";
import { ServiceReportModerator } from "../../services/wiring/ServiceReportModerator.js";
import { SiteNearbyCounter } from "../../services/wiring/SiteNearbyCounter.js";
import { SiteReportMerger } from "../../services/wiring/SiteReportMerger.js";
import { AssetSettings } from "../../settings/AssetSettings.js";
import { BinSettings } from "../../settings/BinSettings.js";
import { CrawledWardSettings } from "../../settings/CrawledWardSettings.js";
import { CrawlSettings } from "../../settings/CrawlSettings.js";
import { buildBrandLabeller } from "../buildBrandLabeller.js";
import { LocationServiceFactory } from "../LocationServiceFactory.js";
import { WardFilesFactory } from "../WardFilesFactory.js";
import type { WorkerDeps } from "./WorkerDeps.js";

// The report steps in order: moderate, verify (ml), brands, locate, merge into a site with nearby places and bins, and queue the district's crawl.
export class ReportStepsFactory {
  readonly #deps: WorkerDeps;

  constructor(deps: WorkerDeps) {
    this.#deps = deps;
  }

  async steps(): Promise<PipelineStep[]> {
    const { context, moderation, verifier, reputation, sites } = this.#deps;
    const { settings: core, env, logger } = context;
    const location = LocationServiceFactory.fromEnv(core, env).create();
    const [located, places, bins] = await Promise.all([location, this.#places(), this.#bins()]);
    const wasteCheck = (report: Report) => report.hasPhoto() && report.needsWasteCheck();
    return [
      // A no_bin report may have no photo, and a no_bin photo is never judged as waste (decision 20261010-1630).
      new ConditionalStep(new ModerateStep(new ServiceReportModerator(moderation)), (report) => report.hasPhoto()),
      new ConditionalStep(new VerifyStep(verifier, reputation, new SiteNearbyCounter(sites.finder())), wasteCheck),
      new ConditionalStep(new BrandsStep(new LabellerBrandReader(buildBrandLabeller({ core, env, logger }))), wasteCheck),
      new LocateStep(new ServiceReportLocator(located)),
      new MergeStep(this.#merger(places, bins)),
    ];
  }

  #merger(places: NearPlacesFinder, bins: BinLocator): ReportMerger {
    const merger = new SiteReportMerger(this.#deps.sites.merger(), places, bins);
    return new ActivatingReportMerger(merger, this.#activator(), this.#deps.context.logger);
  }

  #activator(): CrawlActivator {
    const { crawlsTable, activateAfter } = CrawlSettings.fromEnv(this.#deps.context.env);
    if (crawlsTable === null) {
      return new DisabledCrawlActivator();
    }
    const crawls = { table: crawlsTable, activateAfter };
    return new DynamoCrawlActivator(this.#deps.documents, crawls, new SystemClock(), new AwsCalls());
  }

  async #places(): Promise<NearPlacesFinder> {
    const { settings: core, env, logger } = this.#deps.context;
    const { assetsDir } = AssetSettings.fromEnv(env);
    const { originalsBucket } = CrawledWardSettings.fromEnv(env);
    const files = new WardFilesFactory().create({ assetsDir, originalsBucket, awsRegion: core.awsRegion }, logger);
    const layers = await new FileMapLayerSource(files).layers();
    logger.info({ layers: layers.length }, "nearby-place layers loaded");
    return new NearPlacesFinder(layers);
  }

  async #bins(): Promise<BinLocator> {
    const { env, logger } = this.#deps.context;
    const { assetsDir } = AssetSettings.fromEnv(env);
    const data = await new FileBinSource(new FileAssetReader(assetsDir), assetsDir).load();
    logger.info({ bins: data.bins.length, towns: data.mappedTowns }, "known bins loaded");
    return new BinLocator(data, BinSettings.fromEnv(env).radiusM);
  }
}
