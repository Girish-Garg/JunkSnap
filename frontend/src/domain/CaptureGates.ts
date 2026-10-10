import { ActionGate, blocked, type AvailabilityRule } from './ActionAvailability';
import { GateRules, type SessionFacts } from './GateRules';
import type { GpsFix } from './ReportUpload';

/** decision 20261010-1630: the server refuses a no-bin report less accurate than this. */
const NO_BIN_ACCURACY_M = 50;

export interface CameraFacts {
  /** The live camera's state: starting, live, or a capture problem such as camera_denied. */
  readonly camera: string;
  /** The fix the shutter freezes with the photo; null until the GPS has one. */
  readonly fix: GpsFix | null;
  readonly gpsDenied: boolean;
  readonly busy?: boolean;
  /** Reason key for blocked location: the browser and the Android app word it differently. */
  readonly gpsNeededReason: string;
}

export interface RecordFacts extends CameraFacts {
  readonly recorderSupported: boolean;
  readonly chosen: boolean;
}

export interface SendFacts {
  readonly busy?: boolean;
  /** Type and place are picked. */
  readonly chosen: boolean;
  /** A no-bin photo's fix in metres when it is worse than 50 m, else null. */
  readonly vagueM: number | null;
  /** A photo for a site taken farther than it can join from: the limit in metres, else null or absent. */
  readonly tooFarLimitM?: number | null;
}

export interface NoBinFacts extends Omit<SessionFacts, 'cooling'> {
  readonly fix: GpsFix | null;
  readonly sent: boolean;
}

type CameraRule = AvailabilityRule<CameraFacts>;

// The camera's own problems (blocked, missing, not https) replace the shutter with help, so they never reach here.
const CAMERA: readonly CameraRule[] = [
  GateRules.busy('snap.saving'),
  GateRules.waitWhile((facts) => facts.camera !== 'live', 'snap.starting'),
  (facts) => (facts.fix === null && facts.gpsDenied ? blocked(facts.gpsNeededReason) : null),
  GateRules.waitWhile((facts) => facts.fix === null, 'snap.waitingForGps'),
];

const vague = (fix: GpsFix | null) => fix !== null && fix.accuracy_m > NO_BIN_ACCURACY_M;

/** Snap, Scan and No bin: what the shutter, record and send buttons wait for. None needs sign-in to start. */
export const CAPTURE_GATES = {
  shutter: new ActionGate<CameraFacts>(CAMERA),
  record: new ActionGate<RecordFacts>([
    GateRules.when((facts) => !facts.recorderSupported, 'scan.recorder_unsupported'),
    ...CAMERA,
    GateRules.when((facts) => !facts.chosen, 'gate.pickPlace'),
  ]),
  // A photo is saved on the phone first and sends once online and signed in, so Send needs neither.
  send: new ActionGate<SendFacts>([
    GateRules.busy(),
    (facts) => (facts.vagueM === null ? null : blocked('nobin.photoTooVague', { metres: Math.round(facts.vagueM) })),
    (facts) => (facts.tooFarLimitM == null ? null : blocked('addPhoto.tooFar', { limit: facts.tooFarLimitM })),
    GateRules.when((facts) => !facts.chosen, 'gate.pickPlace'),
  ]),
  // A no-bin report without a photo goes straight to the api.
  noBin: new ActionGate<NoBinFacts>([
    GateRules.when((facts) => facts.sent, 'nobin.sent'),
    GateRules.busy('nobin.sending'),
    GateRules.waitWhile((facts) => facts.fix === null, 'nobin.waiting'),
    (facts) => (vague(facts.fix) ? blocked('nobin.tooVague', { metres: Math.round(facts.fix?.accuracy_m ?? 0) }) : null),
    GateRules.offline(),
    GateRules.signIn('nobin.signIn'),
  ]),
} as const;
