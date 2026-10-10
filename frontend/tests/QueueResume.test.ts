import { describe, expect, it } from 'vitest';
import { QueueLock } from '../src/services/QueueLock';
import { QueueTriggers } from '../src/services/QueueTriggers';
import { ReportQueue } from '../src/services/ReportQueue';
import { ReportSender } from '../src/services/ReportSender';
import type { RequestIdentity } from '../src/services/ReportApi';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore } from './helpers';
import { DEVICE_TOKEN, FakeClock, MemoryReportStore, sampleDraft } from './snapFakes';
import { MockAuthService } from '../src/services/MockAuthService';

const PHOTO = new TextEncoder().encode('jpeg').buffer;

/** An identity whose token can be switched on, and which counts forced refreshes. */
class SwitchableIdentity implements RequestIdentity {
  token: string | null = 'id-token';
  forced = 0;

  async idToken(forceRefresh = false): Promise<string | null> {
    if (forceRefresh) this.forced += 1;
    return this.token;
  }

  async deviceToken(): Promise<string> {
    return DEVICE_TOKEN;
  }
}

function setup(locks?: LockManager) {
  const api = new FakeReportApi();
  const identity = new SwitchableIdentity();
  const clock = new FakeClock();
  const queue = new ReportQueue({ store: new MemoryReportStore(), sender: new ReportSender(api, identity, clock), clock, lock: new QueueLock(locks) });
  return { api, identity, queue };
}

describe('a 401 with a signed-in user', () => {
  it('refreshes the token once and retries the same step', async () => {
    const { api, identity, queue } = setup();
    api.failNext('presign', 401, 'unauthorized');
    const added = await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    expect(identity.forced).toBe(1);
    expect(api.count('presign')).toBe(2);
    expect(queue.find(added.id)?.data.stage).toBe('sent');
  });
});

describe('a report added while a drain finishes', () => {
  it('is sent without waiting for another trigger', async () => {
    let release = () => undefined as void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const locks = { request: async (_name: string, task: () => Promise<void>) => (await task(), await gate) } as unknown as LockManager;
    const { api, queue } = setup(locks);
    await queue.add(sampleDraft('a'.repeat(64)), PHOTO);
    await expect.poll(() => api.count('submit')).toBe(1);
    const late = await queue.add(sampleDraft('b'.repeat(64)), PHOTO);
    release();
    await queue.flush();
    expect(api.count('submit')).toBe(2);
    expect(queue.find(late.id)?.data.stage).toBe('sent');
  });
});

describe('QueueTriggers', () => {
  it('reads the token when the phone comes online and sends reports parked for sign-in', async () => {
    const { api, identity, queue } = setup();
    identity.token = null;
    const added = await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    expect(queue.find(added.id)?.data.problem).toBe('sign_in');
    identity.token = 'id-token';
    const auth = new MockAuthService(new MemoryStore(), 0);
    auth.idToken = async () => 'id-token';
    const events = new EventTarget();
    const document = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    new QueueTriggers([queue], { window: events as Window, document: document as unknown as Document, auth }).start();
    events.dispatchEvent(new Event('online'));
    await expect.poll(() => queue.find(added.id)?.data.stage).toBe('sent');
    expect(api.count('submit')).toBe(1);
  });
});
