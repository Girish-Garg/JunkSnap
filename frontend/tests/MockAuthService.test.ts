import { describe, expect, it } from 'vitest';
import { MockAuthService } from '../src/services/MockAuthService';
import { MemoryStore } from './helpers';

const EMAIL = 'resident@example.com';
const PASSWORD = 'Jodhpur-2026';

describe('MockAuthService sign-up', () => {
  it('signs up, confirms with the emailed code and keeps the session', async () => {
    const store = new MemoryStore();
    const auth = new MockAuthService(store, 0);
    await auth.signUp(EMAIL, PASSWORD);
    await expect(auth.signIn(EMAIL, PASSWORD)).rejects.toMatchObject({ problem: 'not_confirmed' });
    await auth.confirmSignUp(EMAIL, auth.sampleCode());
    expect(auth.currentUser()).toEqual({ email: EMAIL });
    expect(new MockAuthService(store, 0).currentUser()).toEqual({ email: EMAIL });
  });

  it('rejects a wrong code and a second account for the same email', async () => {
    const auth = new MockAuthService(new MemoryStore(), 0);
    await auth.signUp(EMAIL, PASSWORD);
    await expect(auth.confirmSignUp(EMAIL, '000000')).rejects.toMatchObject({ problem: 'bad_code' });
    await auth.confirmSignUp(EMAIL, auth.sampleCode());
    await expect(auth.signUp(EMAIL, PASSWORD)).rejects.toMatchObject({ problem: 'exists' });
  });
});

describe('MockAuthService sign-in and reset', () => {
  it('rejects a wrong password, resets it and signs out', async () => {
    const auth = new MockAuthService(new MemoryStore(), 0);
    await auth.signUp(EMAIL, PASSWORD);
    await auth.confirmSignUp(EMAIL, auth.sampleCode());
    await expect(auth.signIn(EMAIL, 'wrong-password')).rejects.toMatchObject({ problem: 'wrong_credentials' });
    await auth.resetPassword(EMAIL, auth.sampleCode(), 'New-password-1');
    await expect(auth.signIn(EMAIL, 'New-password-1')).resolves.toEqual({ email: EMAIL });
    await auth.signOut();
    expect(auth.currentUser()).toBeNull();
  });
});
