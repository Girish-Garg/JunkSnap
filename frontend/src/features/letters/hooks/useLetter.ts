import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { ActionProblem } from '../../site/ActionProblem';
import type { LetterDraft, LetterLanguage } from '../../../domain/SiteActions';

// Error codes from POST /sites/{id}/letters with their own message.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['not_verified', 'no_local_body', 'rate_limited', 'not_found']);

const problemOf = (error: unknown) => ActionProblem.of(error, KNOWN_ERRORS);

/** Pick the letter language (the app's by default), then ask the api for a cited draft. */
export function useLetter(siteId: string) {
  const { i18n } = useTranslation();
  const { snap } = useServices();
  const [language, setLanguage] = useState<LetterLanguage>(i18n.language === 'hi' ? 'hi' : 'en');
  const [draft, setDraft] = useState<LetterDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const request = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setDraft(await snap.siteActions.letter(siteId, language));
    } catch (error) {
      setProblem(problemOf(error));
    } finally {
      setBusy(false);
    }
  };
  return { language, setLanguage, draft, busy, problem, request: () => void request(), reset: () => setDraft(null) };
}

export type LetterFlow = ReturnType<typeof useLetter>;
