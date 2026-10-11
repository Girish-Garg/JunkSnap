import type { QueueItem, QueueItemData } from '../domain/QueueItem';
import type { Clock } from './Clock';
import type { QueueLock } from './QueueLock';
import { RetryPolicy } from './RetryPolicy';
import type { ItemStore } from './ReportStore';

export interface ItemSender<Item> {
  step(item: Item): Promise<Item>;
}

export interface QueuePorts<Item, Data extends QueueItemData> {
  readonly store: ItemStore<Data>;
  readonly sender: ItemSender<Item>;
  readonly clock: Clock;
  readonly lock: QueueLock;
}

const MIN_TIMER_MS = 1_000;

/** Every capture is saved on the phone first, then sent oldest first, one step at a time. */
export abstract class UploadQueue<Item extends QueueItem<Item, Data>, Data extends QueueItemData> {
  protected readonly ports: QueuePorts<Item, Data>;
  readonly #listeners = new Set<() => void>();
  #items: readonly Item[] = [];
  #loaded: Promise<void> | null = null;
  #ready = false;
  #flushing: Promise<void> | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(ports: QueuePorts<Item, Data>) {
    this.ports = ports;
  }

  /** Turns a stored row back into an item. */
  protected abstract revive(data: Data): Item;

  load(): Promise<void> {
    this.#loaded ??= this.#reload();
    return this.#loaded;
  }

  /** True once the stored rows have been read, so an empty snapshot really is empty. */
  ready(): boolean {
    return this.#ready;
  }

  /** Newest first; a new array after every change, for useSyncExternalStore. */
  snapshot(): readonly Item[] {
    return this.#items;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  find(id: string): Item | undefined {
    return this.#items.find((item) => item.id === id);
  }

  async save(item: Item): Promise<void> {
    await this.ports.store.put(item.data);
    this.#replace([item, ...this.#items.filter((other) => other.id !== item.id)]);
  }

  async remove(id: string): Promise<void> {
    await this.ports.store.delete(id);
    this.#replace(this.#items.filter((item) => item.id !== id));
  }

  /** Clears the wait on the matching items and sends now. */
  async retry(matches: (item: Item) => boolean): Promise<void> {
    await this.load();
    for (const item of this.#items.filter(matches)) await this.save(item.retryNow());
    await this.flush();
  }

  /** Re-reads the stored row, so a change saved meanwhile (by a send step) is not overwritten. */
  async update(id: string, change: (item: Item) => Item): Promise<void> {
    const row = await this.ports.store.get(id);
    if (row) await this.save(change(this.revive(row)));
  }

  flush(): Promise<void> {
    this.#flushing ??= this.#untilIdle().finally(() => {
      this.#flushing = null;
      this.#schedule();
    });
    return this.#flushing;
  }

  /** The same capture twice returns the first entry, so it is never sent twice. */
  protected async enqueue(item: Item): Promise<Item> {
    await this.load();
    const existing = this.find(item.id);
    if (existing) return existing;
    await this.save(item);
    void this.flush();
    return item;
  }

  // An item added while a drain was finishing is due now; drain again rather than wait for a trigger.
  async #untilIdle(): Promise<void> {
    do {
      await this.ports.lock.run(() => this.#drain());
    } while (this.#nextDue());
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
  async #advance(item: Item): Promise<boolean> {
    let next: Item;
    let keepGoing = true;
    try {
      next = await this.ports.sender.step(item);
    } catch (error) {
      const problem = RetryPolicy.problemOf(error);
      next = item.failed(problem, RetryPolicy.retryAt(problem, item.data.attempts + 1, this.ports.clock.now()));
      keepGoing = problem === 'refused';
    }
    // Removed by the reporter mid-send: do not bring it back.
    if (this.find(item.id)) await this.save(next);
    return keepGoing;
  }

  #nextDue(): Item | undefined {
    const now = this.ports.clock.now();
    return this.#items.findLast((item) => item.isDue(now));
  }

  #schedule(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const waits = this.#items.flatMap((i) => (i.isPending() && i.data.problem !== 'sign_in' && i.data.retry_at ? [Date.parse(i.data.retry_at)] : []));
    if (waits.length === 0) return;
    const delay = Math.max(Math.min(...waits) - this.ports.clock.now().getTime(), MIN_TIMER_MS);
    this.#timer = setTimeout(() => void this.flush(), delay);
  }

  async #reload(): Promise<void> {
    const rows = await this.ports.store.all();
    this.#ready = true;
    this.#replace(rows.map((row) => this.revive(row)));
  }

  #replace(items: readonly Item[]): void {
    this.#items = [...items].sort((a, b) => b.data.saved_at.localeCompare(a.data.saved_at));
    for (const listener of this.#listeners) listener();
  }
}
