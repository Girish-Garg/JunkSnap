import { areaFixtureLoaders } from '../src/services/areaFixtures';
import { crawlFixtureLoaders } from '../src/services/crawlFixtures';
import { reportEvidenceLoaders } from '../src/services/reportFixtures';
import { sampleAreaLetterLoader, sampleLetterLoader, sampleSiteLoader, siteFixtureLoaders } from '../src/services/siteFixtures';

/**
 * Mock mode reads contracts/fixtures through lazy imports, and in Vitest a first import is a round trip to the
 * main process, which also transforms modules for every other worker. With three suites running that took 0.5 s
 * on average and up to 4 s per test file, and it used to land inside the first test's first wait for a site.
 * Importing every fixture before the tests start leaves the mocks answering from the module cache.
 */
export async function preloadFixtures(): Promise<void> {
  const loaders: readonly (() => Promise<unknown>)[] = [
    ...Object.values(siteFixtureLoaders),
    ...Object.values(areaFixtureLoaders),
    ...Object.values(crawlFixtureLoaders),
    ...Object.values(reportEvidenceLoaders),
    sampleSiteLoader,
    sampleLetterLoader,
    sampleAreaLetterLoader,
  ];
  await Promise.all(loaders.map((load) => load()));
}
