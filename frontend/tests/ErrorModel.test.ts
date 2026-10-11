import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/domain/ApiError';
import { AuthError } from '../src/domain/AuthError';
import { CaptureError } from '../src/domain/CaptureError';
import { ErrorClassifier, type ErrorCategory } from '../src/domain/ErrorClassifier';
import { LocationError } from '../src/domain/LocationError';
import { ActionProblem } from '../src/features/site/ActionProblem';
import { ActionCooldowns } from '../src/services/ActionCooldowns';
import { DEFAULTS } from './config';
import { ERROR_TAG, ErrorReporter } from '../src/services/ErrorReporter';
import { HttpErrors } from '../src/services/HttpErrors';
import { Notifier } from '../src/services/Notifier';
import type { Timer } from '../src/services/Timer';

const category = (error: unknown, online = true) => ErrorClassifier.classify(error, online).category;

describe('ErrorClassifier', () => {
  it('sorts every api status from contracts/README.md into a category and keeps the code', () => {
    const cases: readonly [number, string, ErrorCategory][] = [
      [400, 'bad_request', 'validation'],
      [400, 'bbox_too_large', 'validation'],
      [401, 'unauthorized', 'auth_expired'],
      [403, 'forbidden', 'forbidden'],
      [403, 'own_site', 'forbidden'],
      [403, 'too_far', 'forbidden'],
      [404, 'not_found', 'not_found'],
      [404, 'area_not_found', 'not_found'],
      [409, 'cleanup_pending', 'conflict'],
      [409, 'not_verified', 'conflict'],
      [409, 'site_verified', 'conflict'],
      [422, 'no_local_body', 'validation'],
      [422, 'target_too_far', 'validation'],
      [429, 'rate_limited', 'rate_limited'],
      [500, 'server_error', 'server'],
      [503, 'server_error', 'server'],
    ];
    for (const [status, code, expected] of cases) {
      expect(ErrorClassifier.classify(new ApiError(status, code, 'English words'), true)).toMatchObject({ category: expected, code, status });
    }
  });
});

describe('ErrorClassifier: no response', () => {
  it('tells offline, a failing network and a timeout apart', () => {
    const lost = HttpErrors.network('Request to /sites', new TypeError('Failed to fetch'));
    expect(category(lost, false)).toBe('offline');
    expect(category(lost, true)).toBe('network');
    expect(category(new TypeError('Failed to fetch'), false)).toBe('offline');
    const timedOut = HttpErrors.network('Request to /sites', new DOMException('signal timed out', 'TimeoutError'));
    expect(timedOut.code).toBe('timeout');
    expect(category(timedOut)).toBe('timeout');
    expect(category(new DOMException('The user aborted a request.', 'AbortError'))).toBe('aborted');
  });

  it('reads sign-in, location and camera errors, and calls anything else unknown', () => {
    expect(category(new AuthError('wrong_credentials', 'Sign in to send'))).toBe('auth_expired');
    expect(category(new AuthError('network', 'offline'), false)).toBe('offline');
    expect(category(new AuthError('too_many', 'slow down'))).toBe('rate_limited');
    expect(category(new AuthError('unavailable', 'no pool'))).toBe('server');
    expect(category(new LocationError('denied', 'User denied Geolocation'))).toBe('location');
    expect(ErrorClassifier.classify(new CaptureError('camera_denied', 'NotAllowedError'), true)).toMatchObject({ category: 'camera', code: 'camera_denied' });
    expect(category(new Error('boom'))).toBe('unknown');
    expect(category('a string')).toBe('unknown');
  });
});

describe('ErrorClassifier: retrying', () => {
  it('marks what can work again later without the person changing anything', () => {
    const retryable = (error: unknown) => ErrorClassifier.classify(error, true).retryable;
    expect(retryable(new ApiError(429, 'rate_limited', ''))).toBe(true);
    expect(retryable(new ApiError(500, 'server_error', ''))).toBe(true);
    expect(retryable(new ApiError(0, 'network_error', ''))).toBe(true);
    expect(retryable(new ApiError(403, 'own_site', ''))).toBe(false);
    expect(retryable(new ApiError(401, 'unauthorized', ''))).toBe(false);
  });
});

describe('ActionProblem', () => {
  const KNOWN = new Set(['own_site', 'rate_limited']);

  it('uses the action words for a known code, else offline, sign_in or failed; never the server text', () => {
    expect(ActionProblem.of(new ApiError(403, 'own_site', 'Server says no'), KNOWN)).toBe('own_site');
    expect(ActionProblem.of(new ApiError(409, 'site_verified', 'Server says no'), KNOWN)).toBe('failed');
    expect(ActionProblem.of(new ApiError(0, 'network_error', ''), KNOWN, false)).toBe('offline');
    expect(ActionProblem.of(new ApiError(0, 'network_error', ''), KNOWN, true)).toBe('offline');
    expect(ActionProblem.of(new ApiError(401, 'unauthorized', ''), KNOWN)).toBe('sign_in');
    expect(ActionProblem.of(new AuthError('wrong_credentials', ''), KNOWN)).toBe('sign_in');
    expect(ActionProblem.of(new ApiError(500, 'server_error', 'Traceback'), KNOWN)).toBe('failed');
    expect(ActionProblem.of(new ApiError(0, 'timeout', ''), KNOWN)).toBe('failed');
  });

  it('says location only where the action has its own line for it', () => {
    const denied = new LocationError('denied', 'User denied Geolocation');
    expect(ActionProblem.of(denied, KNOWN)).toBe('failed');
    expect(ActionProblem.of(denied, new Set(['location']))).toBe('location');
  });
});

describe('ErrorReporter', () => {
  it('logs one structured, tagged line per failure and returns the classification', () => {
    const warn = vi.fn();
    const reporter = new ErrorReporter({ warn }, () => true);
    expect(reporter.report('vote', new ApiError(429, 'rate_limited', 'Too many')).category).toBe('rate_limited');
    expect(warn).toHaveBeenCalledWith(ERROR_TAG, expect.objectContaining({ where: 'vote', category: 'rate_limited', code: 'rate_limited', status: 429, message: 'Too many' }));
  });

  it('logs uncaught errors and rejected promises with the same tag', () => {
    const warn = vi.fn();
    const target = new EventTarget();
    new ErrorReporter({ warn }, () => false).watch(target);
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new TypeError('Failed to fetch') }));
    expect(warn).toHaveBeenCalledWith(ERROR_TAG, expect.objectContaining({ where: 'unhandled', category: 'offline' }));
  });
});

describe('Notifier', () => {
  it('shows one toast at a time, never queues the same line twice, and restarts it when asked again', () => {
    const notifier = new Notifier();
    const dismissCurrent = () => notifier.dismiss(notifier.current()?.id ?? 0);
    const changes = vi.fn();
    notifier.subscribe(changes);
    notifier.push({ key: 'gate.offline' });
    const first = notifier.current();
    notifier.push({ key: 'connection.back' });
    notifier.push({ key: 'connection.back' });
    expect(notifier.current()?.key).toBe('gate.offline');
    notifier.push({ key: 'gate.offline' });
    expect(notifier.current()?.key).toBe('gate.offline');
    expect(notifier.current()?.id).not.toBe(first?.id);
    dismissCurrent();
    expect(notifier.current()).toMatchObject({ key: 'connection.back', tone: 'info' });
    dismissCurrent();
    expect(notifier.current()).toBeNull();
    expect(changes).toHaveBeenCalledTimes(5);
    notifier.push({ key: 'gate.offline' });
    notifier.push({ key: 'connection.back' });
    notifier.drop('gate.offline');
    expect(notifier.current()?.key).toBe('connection.back');
  });
});

describe('ActionCooldowns', () => {
  it('holds a rate-limited group for a minute, then lets it go', () => {
    let now = 1_000;
    const timers: (() => void)[] = [];
    const timer: Timer = { set: (run) => timers.push(run), clear: () => undefined };
    const cooldowns = new ActionCooldowns(timer, () => now);
    const changes = vi.fn();
    cooldowns.subscribe(changes);
    cooldowns.hold('letter');
    expect(cooldowns.active()).toEqual(new Set(['letter']));
    const held = cooldowns.active();
    now += DEFAULTS.ui.cooldownMs - 1;
    timers[0]?.();
    expect(cooldowns.active()).toBe(held);
    now += 1;
    timers[0]?.();
    expect(cooldowns.active().size).toBe(0);
    expect(changes).toHaveBeenCalledTimes(2);
  });
});
