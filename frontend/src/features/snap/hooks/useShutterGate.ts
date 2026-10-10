import { CAPTURE_GATES } from '../../../domain/CaptureGates';
import { useInAppKey } from '../../../ui/useNativeBridge';
import { gatedBy, type GatedAction } from '../../actions/GatedAction';
import { useGate } from '../../actions/hooks/useGate';
import type { GpsState } from './useGpsFix';

/** The shutter: waits for a live camera and a fix; with location blocked it says how to allow it. */
export function useShutterGate(ready: boolean, gps: GpsState): { readonly shutter: GatedAction; readonly gpsNeeded: string } {
  const gate = useGate();
  const gpsNeeded = useInAppKey('snap.gpsNeeded', 'snap.gpsNeededApp');
  const facts = { camera: ready ? 'live' : 'starting', fix: gps.fix, gpsDenied: gps.problem === 'denied', gpsNeededReason: gpsNeeded };
  return { shutter: gatedBy(gate, CAPTURE_GATES.shutter.decide(facts)), gpsNeeded };
}
