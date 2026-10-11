import { describe, expect, it } from 'vitest';
import { blocked, lookOf, waiting, type Availability } from '../src/domain/ActionAvailability';
import { CAPTURE_GATES, type CameraFacts, type NoBinFacts } from '../src/domain/CaptureGates';
import type { SessionFacts } from '../src/domain/GateRules';
import {
  ACTIVITY_DELETE_GATE,
  AREA_LETTER_GATE,
  CLEANUP_SEND_GATE,
  LETTER_DRAFT_GATE,
  NOTE_SEND_GATE,
  SITE_GATES,
  type SiteActionFacts,
} from '../src/domain/SiteActionGates';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import { DEFAULTS } from './config';

const SESSION: SessionFacts = { signedIn: true, online: true, cooling: new Set() };
const SITE: SiteActionFacts = {
  ...SESSION,
  site: { verification: 'verified', status: 'open', cleanup_status: 'none' },
  ownSite: false,
  distanceM: 200,
  locationDenied: false,
  addPhotoLimitM: 490,
  reach: DEFAULTS.site,
};
const site = (patch: Partial<SiteActionFacts>): SiteActionFacts => ({ ...SITE, ...patch });
const cooling = (group: string) => new Set([group]);
const reasonOf = (availability: Availability) => (availability.enabled ? null : availability.reason);
const OK = { enabled: true };
const FIX = { lat: 26.26, lon: 73.0, accuracy_m: 8 };

// Every reason the gates give, so the last test can check both languages word each one.
const reasons = new Set<string>();
const seen = (availability: Availability) => {
  if (!availability.enabled) reasons.add(availability.reason);
  return availability;
};

describe('site action gates', () => {
  it('a vote: open by default; off for its own reporter, too far, location blocked, rate limited, offline; sign-in last', () => {
    const vote = (patch: Partial<SiteActionFacts>) => seen(SITE_GATES.vote.decide(site(patch)));
    expect(vote({})).toEqual(OK);
    expect(vote({ busy: true })).toEqual(waiting('gate.busy'));
    expect(vote({ ownSite: true })).toEqual(blocked('vote.errors.own_site'));
    // Too far rests on a fix, so a tap takes a fresh one first (remedy relocate).
    expect(vote({ distanceM: 1250 })).toEqual(blocked('vote.errors.too_far', { limit: 1000 }, 'relocate'));
    // The map's fix is rough, so only clearly too far blocks: 1 km plus a 100 m margin.
    expect(vote({ distanceM: 1080 })).toEqual(OK);
    expect(vote({ distanceM: null })).toEqual(OK);
    expect(vote({ locationDenied: true })).toEqual(blocked('vote.errors.location'));
    expect(vote({ cooling: cooling('vote') })).toEqual(blocked('vote.errors.rate_limited'));
    expect(vote({ online: false })).toEqual(blocked('gate.offline'));
    expect(vote({ signedIn: false })).toEqual(blocked('gate.signIn.vote', undefined, 'signIn'));
  });

  it('says the reason that sign-in or a connection would not fix first', () => {
    expect(reasonOf(SITE_GATES.vote.decide(site({ ownSite: true, online: false, signedIn: false })))).toBe('vote.errors.own_site');
    expect(reasonOf(SITE_GATES.vote.decide(site({ distanceM: 5000, signedIn: false })))).toBe('vote.errors.too_far');
    expect(reasonOf(SITE_GATES.letter.decide(site({ site: { verification: 'unverified', status: 'open', cleanup_status: 'none' }, online: false })))).toBe('actions.letterLocked');
  });
});

describe('site action gates: cleanup and letters', () => {
  it('a cleanup photo: off while one is checked or from more than 50 m away', () => {
    const cleanup = (patch: Partial<SiteActionFacts>) => seen(SITE_GATES.cleanup.decide(site(patch)));
    expect(cleanup({ distanceM: 120 })).toEqual(OK);
    expect(cleanup({ site: { verification: 'verified', status: 'open', cleanup_status: 'checking' } })).toEqual(blocked('cleanup.errors.cleanup_pending'));
    expect(cleanup({ distanceM: 400 })).toEqual(blocked('gate.tooFarCleanup', { limit: 50 }, 'relocate'));
    expect(cleanup({ site: { verification: 'verified', status: 'cleaned', cleanup_status: 'accepted' } })).toEqual(blocked('gate.siteClosed'));
    expect(cleanup({ distanceM: 20, cooling: cooling('cleanup') })).toEqual(blocked('cleanup.errors.rate_limited'));
    expect(cleanup({ distanceM: 20, online: false })).toEqual(blocked('gate.offline'));
    expect(cleanup({ distanceM: 20, signedIn: false })).toEqual(blocked('gate.signIn.cleanup', undefined, 'signIn'));
  });

});

describe('site action gates: letters', () => {
  it('a letter waits for 10 people and shares the cooldown with area letters', () => {
    const letter = (patch: Partial<SiteActionFacts>) => seen(SITE_GATES.letter.decide(site(patch)));
    expect(letter({})).toEqual(OK);
    expect(letter({ site: { verification: 'unverified', status: 'open', cleanup_status: 'none' } })).toEqual(blocked('actions.letterLocked'));
    // A deep link to a site that left the map says so before anything else.
    expect(letter({ site: { verification: 'verified', status: 'expired', cleanup_status: 'none' }, signedIn: false })).toEqual(blocked('gate.siteClosed'));
    expect(letter({ cooling: cooling('letter') })).toEqual(blocked('letter.errors.rate_limited'));
    expect(letter({ online: false })).toEqual(blocked('gate.offline'));
    expect(letter({ signedIn: false })).toEqual(blocked('gate.signIn.letter', undefined, 'signIn'));
    const area = (patch: Partial<SessionFacts> & { ready?: boolean }) => seen(AREA_LETTER_GATE.decide({ ...SESSION, ready: true, ...patch }));
    expect(area({})).toEqual(OK);
    expect(area({ ready: false })).toEqual(blocked('areaLetter.locked'));
    expect(area({ cooling: cooling('letter') })).toEqual(blocked('letter.errors.rate_limited'));
    expect(area({ online: false })).toEqual(blocked('gate.offline'));
    expect(area({ signedIn: false })).toEqual(blocked('gate.signIn.letter', undefined, 'signIn'));
    expect(seen(LETTER_DRAFT_GATE.decide({ ...SESSION, busy: true }))).toEqual(waiting('letter.drafting'));
    expect(seen(LETTER_DRAFT_GATE.decide({ ...SESSION, online: false }))).toEqual(blocked('gate.offline'));
  });
});

describe('site action gates: withdraw, notes and delete', () => {
  it('withdraw stays on a verified site, off, with the reason', () => {
    const withdraw = (patch: Partial<SiteActionFacts>) => seen(SITE_GATES.withdraw.decide(site(patch)));
    expect(withdraw({})).toEqual(blocked('withdraw.errors.site_verified'));
    const unverified = { site: { verification: 'unverified', status: 'open', cleanup_status: 'none' } } as const;
    expect(withdraw(unverified)).toEqual(OK);
    expect(withdraw({ ...unverified, cooling: cooling('withdraw') })).toEqual(blocked('withdraw.errors.rate_limited'));
    expect(withdraw({ ...unverified, online: false })).toEqual(blocked('gate.offline'));
    expect(withdraw({ ...unverified, signedIn: false })).toEqual(blocked('gate.signIn.withdraw', undefined, 'signIn'));
  });

  it('a note can be written offline and signed out; Send needs text, a connection and sign-in', () => {
    expect(SITE_GATES.note.decide(site({ online: false, signedIn: false }))).toEqual(OK);
    expect(seen(SITE_GATES.note.decide(site({ cooling: cooling('note') })))).toEqual(blocked('notes.errors.rate_limited'));
    const send = (patch: Partial<SessionFacts> & { empty?: boolean }) => seen(NOTE_SEND_GATE.decide({ ...SESSION, empty: false, ...patch }));
    expect(send({})).toEqual(OK);
    expect(send({ busy: true })).toEqual(waiting('gate.busy'));
    expect(send({ empty: true })).toEqual(blocked('gate.noteEmpty'));
    expect(send({ cooling: cooling('note') })).toEqual(blocked('notes.errors.rate_limited'));
    expect(send({ online: false })).toEqual(blocked('gate.offline'));
    expect(send({ signedIn: false })).toEqual(blocked('gate.signIn.note', undefined, 'signIn'));
  });
});

describe('cleanup send and Activity delete gates', () => {
  it('cleanup send and Activity delete', () => {
    expect(seen(CLEANUP_SEND_GATE.decide({ ...SESSION, busy: true }))).toEqual(waiting('cleanup.sending'));
    expect(seen(CLEANUP_SEND_GATE.decide({ ...SESSION, online: false }))).toEqual(blocked('gate.offline'));
    expect(seen(CLEANUP_SEND_GATE.decide({ ...SESSION, signedIn: false }))).toEqual(blocked('gate.signIn.cleanup', undefined, 'signIn'));
    const remove = (patch: Partial<SessionFacts> & { withdraws?: boolean }) => seen(ACTIVITY_DELETE_GATE.decide({ ...SESSION, withdraws: true, ...patch }));
    // Removing a row from this phone needs nothing; withdrawing from a site needs the api.
    expect(remove({ withdraws: false, online: false, signedIn: false })).toEqual(OK);
    expect(remove({ busy: true })).toEqual(waiting('activityDelete.busy'));
    expect(remove({ cooling: cooling('withdraw') })).toEqual(blocked('activityDelete.errors.rate_limited'));
    expect(remove({ online: false })).toEqual(blocked('gate.offline'));
    expect(remove({ signedIn: false })).toEqual(blocked('gate.signIn.withdraw', undefined, 'signIn'));
  });
});

const CAMERA: CameraFacts = { camera: 'live', fix: FIX, gpsDenied: false, gpsNeededReason: 'snap.gpsNeeded' };

describe('site action gates: report a photo (#133)', () => {
  it('needs the person within 1 km by a fresh fix, then sign-in; offline is left to the request', () => {
    const report = (patch: Partial<SiteActionFacts>) => seen(SITE_GATES.reportPhoto.decide(site(patch)));
    expect(report({ online: false })).toEqual(OK);
    expect(report({ distanceM: 1250 })).toEqual(blocked('gate.tooFarReport', { limit: 1000 }, 'relocate'));
    expect(report({ signedIn: false })).toEqual(blocked('gate.signIn.reportPhoto', undefined, 'signIn'));
    expect(report({ site: { verification: 'verified', status: 'cleaned', cleanup_status: 'accepted' } })).toEqual(blocked('gate.siteClosed'));
  });
});

describe('capture gates: camera', () => {
  it('the shutter waits for the camera and the first fix, and says how to allow location', () => {
    const shutter = (patch: Partial<CameraFacts>) => seen(CAPTURE_GATES.shutter.decide({ ...CAMERA, ...patch }));
    expect(shutter({})).toEqual(OK);
    expect(shutter({ busy: true })).toEqual(waiting('snap.saving'));
    expect(shutter({ camera: 'starting' })).toEqual(waiting('snap.starting'));
    expect(shutter({ fix: null })).toEqual(waiting('snap.waitingForGps'));
    expect(shutter({ fix: null, gpsDenied: true, gpsNeededReason: 'snap.gpsNeededApp' })).toEqual(blocked('snap.gpsNeededApp'));
    seen(blocked('snap.gpsNeeded'));
  });

  it('record needs a recorder and a picked place; Send needs a place and a no-bin fix of 50 m', () => {
    const record = (patch: Partial<CameraFacts> & { recorderSupported?: boolean; chosen?: boolean }) =>
      seen(CAPTURE_GATES.record.decide({ ...CAMERA, recorderSupported: true, chosen: true, ...patch }));
    expect(record({})).toEqual(OK);
    expect(record({ recorderSupported: false })).toEqual(blocked('scan.recorder_unsupported'));
    expect(record({ chosen: false })).toEqual(blocked('gate.pickPlace'));
    const send = (patch: { busy?: boolean; chosen?: boolean; vagueM?: number | null }) => seen(CAPTURE_GATES.send.decide({ chosen: true, vagueM: null, ...patch }));
    expect(send({})).toEqual(OK);
    expect(send({ busy: true })).toEqual(waiting('gate.busy'));
    expect(send({ chosen: false, vagueM: 84.6 })).toEqual(blocked('nobin.photoTooVague', { metres: 85 }));
    expect(send({ chosen: false })).toEqual(blocked('gate.pickPlace'));
  });
});

describe('capture gates: no bin', () => {
  it('No bin: one report from a fix of 50 m or better, online and signed in', () => {
    const NO_BIN: NoBinFacts = { signedIn: true, online: true, fix: FIX, sent: false };
    const noBin = (patch: Partial<NoBinFacts>) => seen(CAPTURE_GATES.noBin.decide({ ...NO_BIN, ...patch }));
    expect(noBin({})).toEqual(OK);
    expect(noBin({ sent: true })).toEqual(blocked('nobin.sent'));
    expect(noBin({ busy: true })).toEqual(waiting('nobin.sending'));
    expect(noBin({ fix: null })).toEqual(waiting('nobin.waiting'));
    expect(noBin({ fix: { ...FIX, accuracy_m: 72.4 } })).toEqual(blocked('nobin.tooVague', { metres: 72 }));
    expect(noBin({ online: false })).toEqual(blocked('gate.offline'));
    expect(noBin({ signedIn: false })).toEqual(blocked('nobin.signIn', undefined, 'signIn'));
  });
});

describe('how an action looks', () => {
  it('disabled only while waiting; muted but tappable when blocked; normal when sign-in fixes it', () => {
    expect(lookOf({ enabled: true })).toEqual({ disabled: false, blocked: false });
    expect(lookOf(waiting('gate.busy'))).toEqual({ disabled: true, blocked: false });
    expect(lookOf(blocked('gate.offline'))).toEqual({ disabled: false, blocked: true });
    expect(lookOf(blocked('gate.signIn.vote', undefined, 'signIn'))).toEqual({ disabled: false, blocked: false });
  });

  it('words every reason in English and Hindi', () => {
    const lookup = (json: object, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], json);
    expect(reasons.size).toBeGreaterThan(25);
    for (const key of reasons) {
      expect(typeof lookup(en, key), key).toBe('string');
      expect(typeof lookup(hi, key), key).toBe('string');
      expect(lookup(hi, key), key).not.toBe(lookup(en, key));
    }
  });
});
