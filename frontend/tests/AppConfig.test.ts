import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../src/app/AppConfig';
import { CACHE_VARS } from '../src/config/CacheSettings';
import { CAPTURE_VARS } from '../src/config/CaptureSettings';
import { EnvReader } from '../src/config/EnvReader';
import type { EnvVar } from '../src/config/EnvVar';
import { LIMIT_VARS } from '../src/config/ListLimits';
import { MAP_VARS } from '../src/config/MapSettings';
import { NETWORK_VARS } from '../src/config/NetworkSettings';
import { SITE_RULE_VARS } from '../src/config/SiteRules';
import { UI_VARS } from '../src/config/UiTimings';
import { BBox } from '../src/domain/BBox';

type Group = Readonly<Record<string, EnvVar<unknown>>>;

// Vite will not serve .env files to a test, so the two documents are read from disk (as the CSS tests do).
type FileReader = { readFileSync(path: string, encoding: 'utf8'): string };
const fs = (await import('node:fs' as string)) as FileReader;
const envExample = fs.readFileSync('.env.example', 'utf8');
const viteEnv = fs.readFileSync('src/vite-env.d.ts', 'utf8');

const GROUPS: readonly Group[] = [SITE_RULE_VARS, MAP_VARS, CAPTURE_VARS, NETWORK_VARS, CACHE_VARS, UI_VARS, LIMIT_VARS];
const NAMES = GROUPS.flatMap((group) => Object.values(group).map((variable) => variable.name));

function read(env: Record<string, string>) {
  const warnings: string[] = [];
  const config = AppConfig.fromEnv(env, (message) => warnings.push(message));
  return { config, warnings };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AppConfig defaults', () => {
  it('keeps the values the app had before they were variables', () => {
    const { config, warnings } = read({});
    expect(warnings).toEqual([]);
    expect(config.site).toMatchObject({ voteRadiusM: 1000, flagRadiusM: 1000, cleanupRadiusM: 50, targetGroundMaxM: 300, targetMaxM: 500, minVerifiedReports: 10 });
    expect(config.map).toMatchObject({ styleUrl: 'https://tiles.openfreemap.org/styles/positron', boundariesPath: 'boundaries/', pilotZoom: 12, thinMax: 2 });
    expect(config.map.tileSpanDeg * config.map.tilesPerSide).toBeCloseTo(3.96);
    expect(config.pilot.centre).toEqual([73.02, 26.27]);
    expect(config.pilot.bounds).toEqual(new BBox(72.96, 26.22, 73.08, 26.36));
    expect(config.capture).toMatchObject({ fixMaxAgeMs: 10_000, staleFixFallbackMs: 15_000, gpsMaxAgeMs: 5_000, scanMaxDurationMs: 60_000, scanMaxBytes: 40 * 1024 * 1024, warmupBudgetMs: 150 });
    expect(config.network).toMatchObject({ requestTimeoutMs: 75_000, putBaseTimeoutMs: 30_000, putMaxTimeoutMs: 900_000, retryFirstMs: 30_000, retryMaxMs: 600_000, presignReuseMs: 240_000 });
    expect(config.cache).toMatchObject({ areaListTtlMs: 300_000, boundaryIndexTtlMs: 600_000, activityTtlMs: 60_000, activitySyncMs: 15_000, reportPollMs: 4_000 });
    expect(config.ui).toMatchObject({ toastMs: 4_500, copiedMs: 2_500 });
    expect(config.limits).toEqual({ mailtoMaxLength: 1800, searchResults: 6, listPageSize: 30 });
  });
});

describe('AppConfig variables', () => {
  it('gives each group its declared defaults, frozen', () => {
    const { config } = read({});
    const groups = [config.site, config.map, config.capture, config.network, config.cache, config.ui, config.limits];
    groups.forEach((group, index) => expect(group).toEqual(EnvReader.defaults(GROUPS[index] as Group)));
    expect(Object.isFrozen(config.map)).toBe(true);
  });

  it('has one variable per name, each declared in vite-env.d.ts and documented in .env.example', () => {
    expect(new Set(NAMES).size).toBe(NAMES.length);
    for (const name of NAMES) {
      expect(viteEnv).toContain(`readonly ${name}?: string;`);
      expect(envExample).toMatch(new RegExp(`^# ${name}=\\S`, 'm'));
    }
  });
});

describe('AppConfig parsing', () => {
  it('reads numbers (with _ separators), URLs, folders, points and boxes', () => {
    const { config, warnings } = read({
      VITE_VOTE_RADIUS_M: ' 800 ',
      VITE_REQUEST_TIMEOUT_MS: '90_000',
      VITE_MAP_FIT_MIN_FREE: '0.3',
      VITE_MAP_STYLE_URL: 'https://tiles.example.test/style.json',
      VITE_BOUNDARIES_PATH: '/data/areas',
      VITE_PILOT_CENTRE: '75.79, 26.91',
      VITE_PILOT_BOUNDS: '75.7,26.8,75.9,27.0',
    });
    expect(warnings).toEqual([]);
    expect(config.site.voteRadiusM).toBe(800);
    expect(config.network.requestTimeoutMs).toBe(90_000);
    expect(config.map).toMatchObject({ fitMinFree: 0.3, styleUrl: 'https://tiles.example.test/style.json', boundariesPath: 'data/areas/' });
    expect(config.pilot.centre).toEqual([75.79, 26.91]);
    expect(config.pilot.within(new BBox(75, 26, 76, 28))).toBe(true);
    expect(config.assetUrl(config.map.boundariesPath, 'https://app.example.test/x')).toBe('https://app.example.test/data/areas/');
  });

  it('takes blank as unset, so an empty line in .env.local changes nothing', () => {
    expect(read({ VITE_TOAST_MS: '', VITE_PILOT_CENTRE: '   ' })).toEqual(read({}));
  });
});

const BAD_VALUES: readonly (readonly [string, string])[] = [
  ['VITE_TOAST_MS', 'soon'],
  ['VITE_TOAST_MS', '-5'],
  ['VITE_TOAST_MS', '1e3'],
  ['VITE_TOAST_MS', '12.5'],
  ['VITE_SCAN_MAX_DURATION_MS', '90000'],
  ['VITE_SITE_TILE_DEG', '1.5'],
  ['VITE_PHOTO_JPEG_QUALITY', '2'],
  ['VITE_MAP_STYLE_URL', 'ftp://tiles.example.test/style'],
  ['VITE_MAP_STYLE_URL', 'positron'],
  ['VITE_BOUNDARIES_PATH', '../secrets'],
  ['VITE_BOUNDARIES_PATH', 'https://other.example.test/b'],
  ['VITE_PILOT_CENTRE', '73.02'],
  ['VITE_PILOT_CENTRE', '200,26'],
  ['VITE_PILOT_BOUNDS', '73.08,26.22,72.96,26.36'],
  ['VITE_PILOT_BOUNDS', '72.96,26.22,73.08'],
];

describe('AppConfig bad values', () => {
  it.each(BAD_VALUES)('%s=%s falls back to the default with a warning, and the app still starts', (name, value) => {
    const { config, warnings } = read({ [name]: value });
    const defaults = read({}).config;
    expect(config.site).toEqual(defaults.site);
    expect(config.map).toEqual(defaults.map);
    expect(config.capture).toEqual(defaults.capture);
    expect(config.ui).toEqual(defaults.ui);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`${name}="${value}" is not valid; using the default`);
  });

  it('still refuses endpoints that cannot work, since live mode cannot guess them', () => {
    expect(() => read({ VITE_API_MODE: 'live' })).toThrow('VITE_API_URL');
    expect(() => read({ VITE_COGNITO_USER_POOL_ID: 'bad' })).toThrow();
  });
});

describe('AppConfig from the build', () => {
  it('reads the VITE_ variables Vite baked in (vi.stubEnv stands in for a build variable)', () => {
    vi.stubEnv('VITE_VOTE_RADIUS_M', '750');
    vi.stubEnv('VITE_PILOT_ZOOM', '13.5');
    vi.stubEnv('VITE_REPORT_POLL_MS', '2000');
    vi.stubEnv('VITE_SEARCH_RESULTS', '10');
    const config = AppConfig.fromBuild();
    expect(config.site.voteRadiusM).toBe(750);
    expect(config.map.pilotZoom).toBe(13.5);
    expect(config.cache.reportPollMs).toBe(2000);
    expect(config.limits.searchResults).toBe(10);
    expect(config.network.requestTimeoutMs).toBe(75_000);
  });

  it('warns on the console, not by throwing, for a bad build variable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('VITE_THIN_MAX', 'few');
    expect(AppConfig.fromBuild().map.thinMax).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('VITE_THIN_MAX="few"'));
    warn.mockRestore();
  });
});
