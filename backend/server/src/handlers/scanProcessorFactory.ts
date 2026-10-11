import { FfmpegVideoFrameReader } from "../adapters/FfmpegVideoFrameReader.js";
import { SharpFrameHasher } from "../adapters/SharpFrameHasher.js";
import { TempScratchSpace } from "../adapters/TempScratchSpace.js";
import type { Logger } from "../ports/Logger.js";
import { FramePlanner } from "../services/FramePlanner.js";
import { FrameSelector } from "../services/FrameSelector.js";
import { ScanFramePublisher } from "../services/ScanFramePublisher.js";
import { ScanFrameSampler } from "../services/ScanFrameSampler.js";
import { ScanVideoLoader } from "../services/ScanVideoLoader.js";
import { VideoScanProcessor } from "../services/VideoScanProcessor.js";
import type { CoreSettings } from "../settings/CoreSettings.js";
import { ScanLimitSettings } from "../settings/ScanLimitSettings.js";
import { ScanSettings } from "../settings/ScanSettings.js";
import type { Env } from "../settings/utils.js";
import { ScanAdapterFactory } from "./ScanAdapterFactory.js";

export interface ScanProcessorContext {
  readonly core: CoreSettings;
  readonly env: Env;
  readonly logger: Logger;
}

// The worker calls this once at startup and routes every kind scan message to the result.
export function buildScanProcessor({ core, env, logger }: ScanProcessorContext): VideoScanProcessor {
  const adapters = new ScanAdapterFactory(ScanSettings.fromEnv(env), core.awsRegion);
  const media = adapters.mediaStore();
  const reader = new FfmpegVideoFrameReader();
  const scratch = new TempScratchSpace();
  const now = (): Date => new Date();
  const limits = ScanLimitSettings.fromEnv(env);
  const sampler = new ScanFrameSampler({
    reader,
    hasher: new SharpFrameHasher(),
    planner: new FramePlanner(limits.frames),
    selector: new FrameSelector(limits.frames),
    gps: limits.gps,
  });
  const publisher = new ScanFramePublisher(
    { media, reports: adapters.frameReports(), queue: adapters.queue(), scratch },
    now,
    limits.frames.spotRadiusM,
  );
  const loader = new ScanVideoLoader(media, reader, limits.video);
  return new VideoScanProcessor({ scans: adapters.scans(), scratch, loader, sampler, publisher, logger, now });
}
