import type { ReportStatusView } from '../domain/ReportStatus';
import type { ReportApi, RequestIdentity } from './ReportApi';
import type { ReportQueue } from './ReportQueue';
import { SignedInStep } from './SignedInStep';

export interface ReportConfirmerPorts {
  readonly api: Pick<ReportApi, 'confirm'>;
  readonly identity: RequestIdentity;
  readonly queue: ReportQueue;
}

/** Sends the reporter's answer to a report the check was unsure about (contracts v1.16) and keeps the new status on the phone. */
export class ReportConfirmer {
  readonly #ports: ReportConfirmerPorts;
  readonly #signedIn: SignedInStep;

  constructor(ports: ReportConfirmerPorts) {
    this.#ports = ports;
    this.#signedIn = new SignedInStep(ports.identity);
  }

  /** sure: the report goes back to the checks; not sure: it is withdrawn. */
  async answer(reportId: string, sure: boolean): Promise<ReportStatusView> {
    const status = await this.#signedIn.run(() => this.#ports.api.confirm(reportId, { sure }));
    const mine = this.#ports.queue.snapshot().find((report) => report.data.report_id === reportId);
    if (mine) await this.#ports.queue.update(mine.id, (latest) => latest.withStatus(status));
    return status;
  }
}
