import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoReportRepository } from "../../adapters/DynamoReportRepository.js";
import { SqsQueuePoller } from "../../adapters/SqsQueuePoller.js";
import { SystemClock } from "../../adapters/SystemClock.js";
import type { QueuePoller } from "../../ports/QueuePoller.js";
import { CleanupPipeline } from "../../services/CleanupPipeline.js";
import { MessageRouter } from "../../services/MessageRouter.js";
import { ReportPipeline } from "../../services/ReportPipeline.js";
import { ScanMessageHandler } from "../../services/wiring/ScanMessageHandler.js";
import { ServiceCleanupModerator } from "../../services/wiring/ServiceCleanupModerator.js";
import { SiteCleanupRecorder } from "../../services/wiring/SiteCleanupRecorder.js";
import { QueueSettings } from "../../settings/QueueSettings.js";
import { buildScanProcessor } from "../scanProcessorFactory.js";
import { AWS_TIMEOUTS, awsClientConfig } from "../utils.js";
import { ReportStepsFactory } from "./ReportStepsFactory.js";
import type { WorkerDeps } from "./WorkerDeps.js";

// Routes each SQS message kind (report, cleanup, scan) to its handler.
export class WorkerGraph {
  readonly #deps: WorkerDeps;

  constructor(deps: WorkerDeps) {
    this.#deps = deps;
  }

  async poller(): Promise<QueuePoller> {
    const { settings, context } = this.#deps;
    const router = new MessageRouter({ report: await this.#report(), cleanup: this.#cleanup(), scan: this.#scan() });
    const { maxReceiveCount, messageDeadlineMs, waitSeconds, batchSize } = QueueSettings.fromEnv(context.env);
    const options = { queueUrl: settings.reportsQueueUrl, maxReceiveCount, messageDeadlineMs, waitSeconds, batchSize };
    const sqs = new SQSClient(awsClientConfig(context.settings.awsRegion, AWS_TIMEOUTS.wait));
    return new SqsQueuePoller(sqs, options, router, context.logger);
  }

  async #report(): Promise<ReportPipeline> {
    const { documents, settings, context } = this.#deps;
    const steps = await new ReportStepsFactory(this.#deps).steps();
    const reports = new DynamoReportRepository(documents, settings.reportsTable);
    return new ReportPipeline({ steps, reports, clock: new SystemClock(), logger: context.logger });
  }

  #cleanup(): CleanupPipeline {
    const { moderation, verifier, reputation, sites, context } = this.#deps;
    const repository = sites.repository();
    return new CleanupPipeline({
      moderator: new ServiceCleanupModerator(moderation, repository),
      verifier,
      recorder: new SiteCleanupRecorder(repository, sites.cleanupService()),
      reputation,
      logger: context.logger,
    });
  }

  #scan(): ScanMessageHandler {
    const { settings: core, env, logger } = this.#deps.context;
    return new ScanMessageHandler(buildScanProcessor({ core, env, logger }), logger);
  }
}
