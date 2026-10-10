import { describe, expect, it } from 'vitest';
import { JwtSubject } from '../src/domain/JwtSubject';
import { AccountKey } from '../src/services/AccountKey';
import { MockAuthService } from '../src/services/MockAuthService';
import { activityRig, listed, reportIds, scanIds, scanRow, sentRow, signIn, unsentRow } from './activityRig';
import { MemoryStore } from './helpers';
import { MemoryMetaStore } from './snapFakes';

const LATER = '2026-10-10T05:00:00Z';

// The phone's list token as another account's sync left it.
function anotherAccountsToken(): MemoryMetaStore {
  const meta = new MemoryMetaStore();
  void meta.set('activity.token', JSON.stringify({ owner: 'another-account', synced_at: LATER, newest: null }));
  return meta;
}

describe('Activity when another account signed in without a sign-out on this phone', () => {
  it('removes that account\'s sent photos and videos, synced or not, and keeps unsent ones', async () => {
    const synced = sentRow(1).synced(listed(1), new Date(LATER));
    const rows = [synced, sentRow(2), unsentRow(3)];
    const { snap, api } = await activityRig({ rows, scans: [scanRow(4, true), scanRow(5, false)], clock: LATER, meta: anotherAccountsToken() });
    api.pages_ = [[listed(7)]];
    await snap.activity.revalidate();
    expect(reportIds(snap)).toEqual(['3'.repeat(64), 'rpt_7']);
    expect(scanIds(snap)).toEqual(['5'.repeat(64)]);
    expect(snap.activity.trusted()).toBe(true);
  });

  it('removes them even when the listing is longer than the app reads', async () => {
    const { snap, api } = await activityRig({ rows: [sentRow(1)], clock: LATER, meta: anotherAccountsToken() });
    api.pages_ = Array.from({ length: 11 }, (_, page) => [listed(page + 20)]);
    await snap.activity.revalidate();
    expect(api.count('mine')).toBe(10);
    expect(reportIds(snap)).not.toContain('rpt_1');
    expect(reportIds(snap)).toHaveLength(10);
  });
});

describe('the account key', () => {
  const token = (claims: object) => `e30.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.sig`;
  const identity = (value: string | null) => ({ idToken: async () => value });

  it('reads the Cognito sub from the ID token', () => {
    expect(JwtSubject.of(token({ sub: '5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7', email: 'a@example.com' }))).toBe('5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7');
    expect(JwtSubject.of(token({ email: 'a@example.com' }))).toBeNull();
    expect(JwtSubject.of('not-a-jwt')).toBeNull();
  });

  it('keys on the sub, not the email: same sub, same key; another sub, another key', async () => {
    const one = await new AccountKey(identity(token({ sub: 'sub-1', email: 'a@example.com' })), crypto.subtle).current();
    const renamed = await new AccountKey(identity(token({ sub: 'sub-1', email: 'b@example.com' })), crypto.subtle).current();
    const other = await new AccountKey(identity(token({ sub: 'sub-2', email: 'a@example.com' })), crypto.subtle).current();
    expect(renamed).toBe(one);
    expect(other).not.toBe(one);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is null signed out or without a sub, so nothing is trusted', async () => {
    expect(await new AccountKey(identity(null), crypto.subtle).current()).toBeNull();
    expect(await new AccountKey(identity('opaque'), crypto.subtle).current()).toBeNull();
    const failing = { idToken: async () => Promise.reject(new Error('offline')) };
    expect(await new AccountKey(failing, crypto.subtle).current()).toBeNull();
  });
});

describe('the mock account token', () => {
  it('gets a stable sample sub per account in mock mode', async () => {
    const auth = new MockAuthService(new MemoryStore(), 0);
    await signIn(auth, 'resident@example.com');
    const first = JwtSubject.of((await auth.idToken()) ?? '');
    expect(first).toMatch(/^sample-[0-9a-f]+$/);
    expect(JwtSubject.of((await auth.idToken()) ?? '')).toBe(first);
  });
});
