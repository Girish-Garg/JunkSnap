import { QueuedReport } from '../domain/QueuedReport';
import type { ReportDraft } from '../domain/ReportUpload';
import type { Clock } from './Clock';
import type { QueueLock } from './QueueLock';
import type { ReportSender } from './ReportSender';
import { RetryPolicy } from './RetryPolicy';
import type { ReportStore } from './ReportStore';

export interface QueuePorts {
  readonly store: ReportStore;
  readonly sender: ReportSender;
  readonly clock: Clock;
  readonly lock: QueueLock;
}

const MIN_TIMER_MS = 1_000;

/** Every capture is saved on the phone first, then sent oldest first, one step at a time. */
export class ReportQueue {
  readonly #ports: QueuePorts;
  readonly #listeners = new Set<() => void>();
  #reports: readonly QueuedReport[] = [];
  #loaded: Promise<void> | null = null;
  #flushing: Promise<void> | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(ports: QueuePorts) {
    this.#ports = ports;
  }

  load(): Promise<void> {
    this.#loaded ??= this.#reload();
    return this.#loaded;
  }

  /** Newest first; a new array after every change, for useSyncExternalStore. */
  snapshot(): readonly QueuedReport[] {
    return this.#reports;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  find(id: string): QueuedReport | undefined {
    return this.#reports.find((report) => report.id === id);
  }

  /** The same photo twice returns the first entry, so it is never sent twice. */
  async add(draft: ReportDraft, photo: ArrayBuffer): Promise<QueuedReport> {
    await this.load();
    const existing = this.find(draft.sha256);
    if (existing) return existing;
    const report = QueuedReport.capture(draft, photo, this.#ports.clock.now());
    await this.save(report);
    void this.flush();
    return report;
  }

  async save(report: QueuedReport): Promise<void> {
    await this.#ports.store.put(report.data);
    this.#replace([report, ...this.#reports.filter((other) => other.id !== report.id)]);
  }

  async remove(id: string): Promise<void> {
    await this.#ports.store.delete(id);
    this.#replace(this.#reports.filter((report) => report.id !== id));
  }

  /** Clears the wait on the matching reports and sends now. */
  async retry(matches: (report: QueuedReport) => boolean): Promise<void> {
    await this.load();
    for (const report of this.#reports.filter(matches)) await this.save(report.retryNow());
    await this.flush();
  }

  flush(): Promise<void> {
    this.#flushing ??= this.#ports.lock
      .run(() => this.#drain())
      .finally(() => {
        this.#flushing = null;
        this.#schedule();
      });
    return this.#flushing;
  }

  async #drain(): Promise<void> {
    await this.load();
    // Another tab may have sent some while this one waited for the lock.
    await this.#reload();
    for (let next = this.#nextDue(); next; next = this.#nextDue()) {
      if (!(await this.#advance(next))) return;
    }
  }

  /** False stops the drain: the network, the account or the server needs time. */
  async #advance(report: QueuedReport): Promise<boolean> {
    let next: QueuedReport;
    let keepGoing = true;
    try {
      next = await this.#ports.sender.step(report);
    } catch (error) {
      const problem = RetryPolicy.problemOf(error);
      next = report.failed(problem, RetryPolicy.retryAt(problem, report.data.attempts + 1, this.#ports.clock.now()));
      keepGoing = problem === 'refused';
    }
    // Removed by the reporter mid-send: do not bring it back.
    if (this.find(report.id)) await this.save(next);
    return keepGoing;
  }

  #nextDue(): QueuedReport | undefined {
    const now = this.#ports.clock.now();
    return this.#reports.findLast((report) => report.isDue(now));
  }

  #schedule(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const waits = this.#reports.flatMap((r) => (r.isPending() && r.data.problem !== 'sign_in' && r.data.retry_at ? [Date.parse(r.data.retry_at)] : []));
    if (waits.length === 0) return;
    const delay = Math.max(Math.min(...waits) - this.#ports.clock.now().getTime(), MIN_TIMER_MS);
    this.#timer = setTimeout(() => void this.flush(), delay);
  }

  async #reload(): Promise<void> {
    const rows = await this.#ports.store.all();
    this.#replace(rows.map((row) => QueuedReport.fromData(row)));
  }

  #replace(reports: readonly QueuedReport[]): void {
    this.#reports = [...reports].sort((a, b) => b.data.saved_at.localeCompare(a.data.saved_at));
    for (const listener of this.#listeners) listener();
  }
}
