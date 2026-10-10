import { useState } from 'react';
import { REPORT_CONTEXTS } from '../../../domain/ReportContexts';
import type { ReportType } from '../../../domain/ReportType';
import { NOTE_MAX_LENGTH, type GpsFix } from '../../../domain/ReportUpload';
import type { SiteContext } from '../../../domain/Site';
import { NoBinReporter } from '../../../services/NoBinReporter';
import type { ReportChoice } from './useSnapFlow';

/**
 * Type, place and note for one photo. The type starts as asked (No bin's "Add a photo instead"), else a dump;
 * the place has no default, so the reporter picks it. A no-bin report needs the photo's fix at 50 m or better
 * (decision 20261010-1630), so its choice stays empty until then.
 */
export function useReportChoice(initialType: ReportType | null, gps: GpsFix) {
  const [type, setType] = useState<ReportType>(initialType ?? 'waste_dump');
  const [context, setContext] = useState<SiteContext | null>(null);
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const gpsTooVague = type === 'no_bin' && !NoBinReporter.accurateEnough(gps);
  const choice: ReportChoice | null = context && !gpsTooVague ? { report_type: type, context, ...(trimmed ? { note: trimmed } : {}) } : null;
  return {
    type,
    context,
    note,
    contexts: REPORT_CONTEXTS[type],
    choice,
    gpsTooVague,
    chooseType: (next: ReportType) => {
      setType(next);
      setContext(null);
    },
    setContext,
    setNote: (value: string) => setNote(value.slice(0, NOTE_MAX_LENGTH)),
    noteLeft: NOTE_MAX_LENGTH - note.length,
  };
}
