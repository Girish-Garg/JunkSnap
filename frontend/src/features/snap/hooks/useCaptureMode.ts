import { useState } from 'react';
import type { ReportType } from '../../../domain/ReportType';

export type CaptureMode = 'photo' | 'video' | 'nobin';

/**
 * Photo, Video or No bin, and the type a photo was asked for: "Add a photo instead" on No bin
 * opens Photo with no_bin picked. Choosing a mode yourself clears that type. While a video records
 * or saves (recording), the switch is off: leaving Video would drop the clip.
 */
export function useCaptureMode() {
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [presetType, setPresetType] = useState<ReportType | null>(null);
  const [recording, setRecording] = useState(false);
  return {
    mode,
    presetType,
    recording,
    setRecording,
    setMode: (next: CaptureMode) => {
      setPresetType(null);
      setMode(next);
    },
    photoFor: (type: ReportType) => {
      setPresetType(type);
      setMode('photo');
    },
    clearPreset: () => setPresetType(null),
  };
}
