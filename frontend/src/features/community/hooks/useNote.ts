import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { NOTE_TEXT_MAX, type NoteLanguage, type SiteNote } from '../../../domain/Community';
import { ActionProblem } from '../../site/ActionProblem';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';

const KNOWN_ERRORS: ReadonlySet<string> = new Set(['rate_limited', 'not_found']);

/** A note on a site: sign in first, then send; the answer says whether moderation showed it. */
export function useNote(siteId: string, onAdded: () => void) {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const { i18n } = useTranslation();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<NoteLanguage>(i18n.language.startsWith('hi') ? 'hi' : 'en');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SiteNote | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const note = await snap.siteActions.note(siteId, text.trim(), language);
      setResult(note);
      if (note.status === 'shown') setText('');
      onAdded();
    } catch (error) {
      setProblem(ActionProblem.of(error, KNOWN_ERRORS));
    } finally {
      setBusy(false);
    }
  };
  const ready = text.trim() !== '' && !busy;
  return { text, setText, language, setLanguage, busy, result, problem, ready, left: NOTE_TEXT_MAX - text.length, submit: () => requireAuth(() => void send()) };
}
