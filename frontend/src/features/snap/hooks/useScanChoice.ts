import { useState } from 'react';
import { REPORT_CONTEXTS } from '../../../domain/ReportContexts';
import { AUTO, type ScanDraft, type ScanPlace, type ScanType } from '../../../domain/ScanUpload';

/** The places offered for a scan type: Auto first, except for no bin, which a person must assert. */
export function scanPlaces(type: ScanType): readonly ScanPlace[] {
  if (type === AUTO) return [AUTO];
  return type === 'no_bin' ? REPORT_CONTEXTS[type] : [AUTO, ...REPORT_CONTEXTS[type]];
}

function defaultPlace(type: ScanType): ScanPlace | null {
  return scanPlaces(type)[0] === AUTO ? AUTO : null;
}

/** Type and place for one video. Both start on Auto (an area scout), so recording needs no pick. */
export function useScanChoice() {
  const [type, setType] = useState<ScanType>(AUTO);
  const [place, setPlace] = useState<ScanPlace | null>(AUTO);
  const choice: Pick<ScanDraft, 'report_type' | 'context'> | null = place && { report_type: type, context: place };
  return {
    type,
    place,
    places: scanPlaces(type),
    choice,
    chooseType: (next: ScanType) => {
      setType(next);
      setPlace(defaultPlace(next));
    },
    setPlace,
  };
}
