import { describe, expect, it } from 'vitest';
import { AppConfig } from '../src/app/AppConfig';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { AmplifyAuthService, type AmplifyAuthApi } from '../src/services/AmplifyAuthService';
import { CognitoErrors } from '../src/services/CognitoErrors';
import { MemoryStore } from './helpers';

const named = (name: string) => Object.assign(new Error(name), { name });

/** Amplify Auth with an in-memory session; signInFails throws once. */
class FakeAmplify {
  readonly calls: string[] = [];
  session: string | null = null;
  signInFails: Error | null = null;
  signInStep = 'DONE';

  api(): AmplifyAuthApi {
    const record = (call: string) => this.calls.push(call);
    return {
      signIn: async ({ username }: { username: string }) => {
        record(`signIn ${username}`);
        const failure = this.signInFails;
        this.signInFails = null;
        if (failure) throw failure;
        if (this.signInStep === 'DONE') this.session = username;
        return { isSignedIn: this.signInStep === 'DONE', nextStep: { signInStep: this.signInStep } };
      },
      signUp: async ({ username }: { username: string }) => record(`signUp ${username}`),
      confirmSignUp: async ({ username, confirmationCode }: { username: string; confirmationCode: string }) => record(`confirm ${username} ${confirmationCode}`),
      resendSignUpCode: async ({ username }: { username: string }) => record(`resend ${username}`),
      resetPassword: async () => record('reset'),
      confirmResetPassword: async () => record('confirmReset'),
      signOut: async () => {
        record('signOut');
        this.session = null;
      },
      fetchAuthSession: async () => ({ tokens: this.#tokens() }),
    } as unknown as AmplifyAuthApi;
  }

  #tokens() {
    const email = this.session;
    return email ? { idToken: { payload: { email }, toString: () => `id-token-for-${email}` } } : undefined;
  }
}

describe('AmplifyAuthService sign-up and sign-in', () => {
  it('signs up, confirms the code and signs in without asking for the password again', async () => {
    const amplify = new FakeAmplify();
    const auth = new AmplifyAuthService(amplify.api());
    await auth.signUp(' Resident@Example.com ', 'jodhpur2026');
    await expect(auth.confirmSignUp('resident@example.com', '123456')).resolves.toEqual({ email: 'resident@example.com' });
    expect(amplify.calls).toEqual(['signUp resident@example.com', 'confirm resident@example.com 123456', 'signIn resident@example.com']);
    await expect(auth.idToken()).resolves.toBe('id-token-for-resident@example.com');
  });

  it('returns null from confirm when this visit did not make the account', async () => {
    const auth = new AmplifyAuthService(new FakeAmplify().api());
    await expect(auth.confirmSignUp('resident@example.com', '123456')).resolves.toBeNull();
  });

  it('sends a fresh code when an unverified account signs in', async () => {
    const amplify = new FakeAmplify();
    amplify.signInStep = 'CONFIRM_SIGN_UP';
    const auth = new AmplifyAuthService(amplify.api());
    await expect(auth.signIn('resident@example.com', 'jodhpur2026')).rejects.toMatchObject({ problem: 'not_confirmed' });
    expect(amplify.calls).toContain('resend resident@example.com');
  });

  it('turns Cognito errors into form problems', async () => {
    const amplify = new FakeAmplify();
    amplify.signInFails = named('NotAuthorizedException');
    const auth = new AmplifyAuthService(amplify.api());
    await expect(auth.signIn('resident@example.com', 'wrong')).rejects.toMatchObject({ problem: 'wrong_credentials' });
  });
});

describe('AmplifyAuthService sessions', () => {
  it('restores a saved session and tells listeners, saying while it reads it', async () => {
    const amplify = new FakeAmplify();
    amplify.session = 'resident@example.com';
    const auth = new AmplifyAuthService(amplify.api());
    const changes: string[] = [];
    auth.subscribe(() => changes.push(`${auth.currentUser()?.email ?? 'none'}${auth.restoring() ? ' (restoring)' : ''}`));
    expect(auth.restoring()).toBe(false);
    await auth.restore();
    expect(changes).toEqual(['none (restoring)', 'resident@example.com (restoring)', 'resident@example.com']);
    expect(auth.restoring()).toBe(false);
  });

  it('signs out and stops giving a token', async () => {
    const amplify = new FakeAmplify();
    const auth = new AmplifyAuthService(amplify.api());
    await auth.signIn('resident@example.com', 'jodhpur2026');
    await auth.signOut();
    expect(auth.currentUser()).toBeNull();
    await expect(auth.idToken()).resolves.toBeNull();
  });

  it('signs out a stale session that blocks a new sign-in', async () => {
    const amplify = new FakeAmplify();
    amplify.signInFails = named('UserAlreadyAuthenticatedException');
    const auth = new AmplifyAuthService(amplify.api());
    await expect(auth.signIn('resident@example.com', 'jodhpur2026')).resolves.toEqual({ email: 'resident@example.com' });
    expect(amplify.calls).toEqual(['signIn resident@example.com', 'signOut', 'signIn resident@example.com']);
  });
});

describe('Cognito errors and config', () => {
  it('maps Cognito exception names to the form problems', () => {
    expect(CognitoErrors.translate(named('UsernameExistsException')).problem).toBe('exists');
    expect(CognitoErrors.translate(named('InvalidPasswordException')).problem).toBe('weak_password');
    expect(CognitoErrors.translate(named('NetworkError')).problem).toBe('network');
  });

  it('reads the pool region from the pool id', () => {
    const env = { VITE_COGNITO_USER_POOL_ID: 'ap-south-1_bxhFSijz2', VITE_COGNITO_CLIENT_ID: '43mssnkhij5daf0q150ttfhsvt' };
    expect(AppConfig.fromEnv(env).cognito).toEqual({ region: 'ap-south-1', userPoolId: env.VITE_COGNITO_USER_POOL_ID, clientId: env.VITE_COGNITO_CLIENT_ID });
    expect(AppConfig.fromEnv({}).cognito).toBeNull();
    expect(() => AppConfig.fromEnv({ VITE_COGNITO_USER_POOL_ID: 'bad' })).toThrow();
  });
});

describe('live mode accounts', () => {
  it('signs in with Cognito when the pool is configured', () => {
    const config = AppConfig.fromEnv({
      VITE_API_URL: 'https://api.example.test',
      VITE_COGNITO_USER_POOL_ID: 'ap-south-1_bxhFSijz2',
      VITE_COGNITO_CLIENT_ID: '43mssnkhij5daf0q150ttfhsvt',
    });
    const share = { clipboard: { writeText: async () => undefined } as unknown as Clipboard };
    const browser = { store: new MemoryStore(), geolocation: undefined, share, mediaDevices: undefined, crypto, locks: undefined };
    const services = ServiceContainer.build(config, browser);
    expect(services.auth).toBeInstanceOf(AmplifyAuthService);
    expect(services.auth.available()).toBe(true);
  });
});
