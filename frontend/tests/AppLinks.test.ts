import { describe, expect, it, vi } from 'vitest';
import { AppLinkRoutes } from '../src/app/AppLinkRoutes';
import { APP_LINK_EVENT, AppLinkListener } from '../src/services/AppLinkListener';

const API = 'https://d2s7tf4ua41hzf.cloudfront.net';
const WEB = 'https://demo.d3iec0rb3f75jm.amplifyapp.com';

const OPENS: readonly (readonly [string, string])[] = [
  ['junksnap://sites/site_jdh_1', '/sites/site_jdh_1'],
  ['junksnap://sites/site_jdh_1/', '/sites/site_jdh_1'],
  ['JunkSnap://sites/site_jdh_1?from=share#x', '/sites/site_jdh_1'],
  ['junksnap://sites/site_jdh_1/letter', '/sites/site_jdh_1/letter'],
  ['junksnap://areas/assembly/s20-ac-128', '/areas/assembly/s20-ac-128'],
  ['junksnap://areas/ward/jodhpur-uttar-mc-w1/letter', '/areas/ward/jodhpur-uttar-mc-w1/letter'],
  ['junksnap://activity/reports/rpt_jdh_1', '/activity/reports/rpt_jdh_1'],
  [`${API}/share/sites/site_jdh_1`, '/sites/site_jdh_1'],
  [`${API}/share/areas/loksabha/s20-pc-16`, '/areas/loksabha/s20-pc-16'],
  [`${API}/sites/site_jdh_1`, '/sites/site_jdh_1'],
  [`${WEB}/sites/site_jdh_1?utm_source=x#top`, '/sites/site_jdh_1'],
  [`${WEB}/areas/district/rajasthan-jodhpur`, '/areas/district/rajasthan-jodhpur'],
  [`${WEB}/activity/reports/rpt_jdh_1`, '/activity/reports/rpt_jdh_1'],
  ['https://junksnap.coehemang.dev/sites/site_jdh_1', '/sites/site_jdh_1'],
];

const IGNORES: readonly string[] = [
  'junksnap://sites',
  'junksnap://sites/site_jdh_1/cleanup/extra',
  'junksnap://areas/planet/earth',
  'junksnap://account',
  'junksnap://sites/%3Cscript%3E',
  'junksnap://sites/..',
  'junksnap://sites/%E0%A4%A',
  'javascript:alert(1)//sites/site_jdh_1',
  'http://d2s7tf4ua41hzf.cloudfront.net/share/sites/site_jdh_1',
  `${API}/share/letters/site_jdh_1`,
  `${WEB}/`,
  'not a link',
];

describe('AppLinkRoutes', () => {
  const routes = new AppLinkRoutes();

  it.each(OPENS)('%s opens %s', (link, path) => {
    expect(routes.pathFor(link)).toBe(path);
  });

  it.each(IGNORES)('ignores %s', (link) => {
    expect(routes.pathFor(link)).toBeNull();
  });
});

const send = (host: EventTarget, detail: unknown) => host.dispatchEvent(new CustomEvent(APP_LINK_EVENT, { detail }));

describe('AppLinkListener', () => {
  it('tells the app it listens, then opens the route of each link the app hands over', () => {
    const linkReady = vi.fn();
    const host = Object.assign(new EventTarget(), { JunkSnapAndroid: { linkReady } });
    const open = vi.fn();
    new AppLinkListener(host, new AppLinkRoutes()).listen(open);
    expect(linkReady).toHaveBeenCalledOnce();
    send(host, 'junksnap://sites/site_jdh_1');
    send(host, 'junksnap://nowhere');
    send(host, 42);
    expect(open.mock.calls).toEqual([['/sites/site_jdh_1']]);
  });

  it('stops listening, and works in a browser, where there is no app bridge', () => {
    const open = vi.fn();
    const host = new EventTarget();
    new AppLinkListener(host, new AppLinkRoutes()).listen(open)();
    send(host, 'junksnap://sites/site_jdh_2');
    expect(open).not.toHaveBeenCalled();
  });
});
