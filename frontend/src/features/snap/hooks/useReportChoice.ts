import { useState } from 'react';
import { REPORT_CONTEXTS } from '../../../domain/ReportContexts';
import type { ReportType } from '../../../domain/ReportType';
import { NOTE_MAX_LENGTH } from '../../../domain/ReportUpload';
import type { SiteContext } from '../../../domain/Site';
import type { ReportChoice } from './useSnapFlow';

/** Type, place and note for one photo. The place has no default, so the reporter picks it. */
export function useReportChoice() {
  const [type, setType] = useState<ReportType>('waste_dump');
  const [context, setContext] = useState<SiteContext | null>(null);
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  const choice: ReportChoice | null = context && { report_type: type, context, ...(trimmed ? { note: trimmed } : {}) };
  return {
    type,
    context,
    note,
    contexts: REPORT_CONTEXTS[type],
    choice,
    chooseType: (next: ReportType) => {
      setType(next);
      setContext(null);
    },
    setContext,
    setNote: (value: string) => setNote(value.slice(0, NOTE_MAX_LENGTH)),
    noteLeft: NOTE_MAX_LENGTH - note.length,
  };
}
