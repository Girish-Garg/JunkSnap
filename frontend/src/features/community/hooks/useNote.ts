import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { NOTE_TEXT_MAX, type NoteLanguage, type SiteNote } from '../../../domain/Community';
import { NOTE_SEND_GATE } from '../../../domain/SiteActionGates';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useSessionGate } from '../../actions/hooks/useSessionGate';

const KNOWN_ERRORS: ReadonlySet<string> = new Set(['rate_limited', 'not_found']);

/** A note on a site; the form's gate asks for sign-in first. The answer says whether moderation showed it. */
export function useNote(siteId: string, onAdded: () => void) {
  const { snap } = useServices();
  const handle = useActionErrors('note', KNOWN_ERRORS);
  const { i18n } = useTranslation();
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<NoteLanguage>(i18n.language.startsWith('hi') ? 'hi' : 'en');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SiteNote | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (reauthed = false) => {
    setBusy(true);
    setProblem(null);
    try {
      const note = await snap.siteActions.note(siteId, text.trim(), language);
      setResult(note);
      if (note.status === 'shown') setText('');
      onAdded();
    } catch (error) {
      setProblem(handle(error, reauthed ? null : () => void send(true)));
    } finally {
      setBusy(false);
    }
  };
  const sendable = useSessionGate(NOTE_SEND_GATE, { busy, empty: text.trim() === '' });
  return { text, setText, language, setLanguage, busy, result, problem, sendable, left: NOTE_TEXT_MAX - text.length, submit: () => void send() };
}
