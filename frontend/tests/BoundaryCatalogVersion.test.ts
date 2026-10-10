import { describe, expect, it } from 'vitest';
import { BoundaryCatalog } from '../src/services/BoundaryCatalog';
import type { Clock } from '../src/services/Clock';

class FakeClock implements Clock {
  ms = 0;

  now(): Date {
    return new Date(this.ms);
  }
}

interface Deploy {
  version: string;
  name: string;
}

// A static host: index.json names the deploy's version, and the labels file holds that deploy's seat name.
function host(deploy: Deploy, calls: string[]): typeof fetch {
  return async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('index.json')) return Response.json({ layers: { areas: { version: deploy.version, fine: {} } } });
    const feature = { type: 'Feature', properties: { id: 's20-ac-125', name: deploy.name, kind: 'assembly' } };
    return Response.json({ type: 'FeatureCollection', features: [feature] });
  };
}

const names = async (catalog: BoundaryCatalog) => (await catalog.labels()).features.map((f) => f.properties.name);
const TEN_MINUTES = 10 * 60 * 1000;

describe('BoundaryCatalog versions', () => {
  it('stamps every boundary file URL with the version in index.json', async () => {
    const catalog = new BoundaryCatalog('/b/', host({ version: 'abc123', name: 'Luni' }, []));
    await catalog.index();
    expect(catalog.polygonsUrl()).toBe('/b/areas.geojson?v=abc123');
    expect(catalog.fineUrl()).toBe('/b/areas_fine.geojson?v=abc123');
    expect(catalog.labelsUrl()).toBe('/b/areas_labels.geojson?v=abc123');
  });

  it('asks the host for index.json past the browser cache', async () => {
    const inits: (RequestInit | undefined)[] = [];
    const catalog = new BoundaryCatalog('/b/', async (_input, init) => {
      inits.push(init);
      return Response.json({ layers: {} });
    });
    await catalog.index();
    expect(inits[0]).toMatchObject({ cache: 'no-cache' });
  });
});

describe('BoundaryCatalog busting', () => {
  it('keeps the marker points while the version holds, and fetches them again once a deploy changes it', async () => {
    const calls: string[] = [];
    const deploy = { version: 'v1', name: 'Luni' };
    const clock = new FakeClock();
    const catalog = new BoundaryCatalog('/b/', host(deploy, calls), BoundaryCatalog.caches(clock));
    expect(await names(catalog)).toEqual(['Luni']);
    expect(await names(catalog)).toEqual(['Luni']);
    expect(calls.filter((url) => url.includes('labels'))).toEqual(['/b/areas_labels.geojson?v=v1']);

    deploy.version = 'v2';
    deploy.name = 'Luni (new)';
    clock.ms = TEN_MINUTES;
    await catalog.index();
    await expect.poll(() => names(catalog)).toEqual(['Luni (new)']);
    expect(calls.filter((url) => url.includes('labels'))).toEqual(['/b/areas_labels.geojson?v=v1', '/b/areas_labels.geojson?v=v2']);
  });
});
