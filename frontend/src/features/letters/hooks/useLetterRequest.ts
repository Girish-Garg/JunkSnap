import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LetterLanguage } from '../../../domain/SiteActions';
import { ActionProblem } from '../../site/ActionProblem';
import { LetterRefusal } from '../LetterRefusal';

/** Which route the letter is for: the 409 not_verified reads differently for a site and an area. */
export type LetterScope = 'site' | 'area';

// Error codes from the letter routes with their own message.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['not_verified', 'no_local_body', 'rate_limited', 'not_found', 'area_not_found']);

const problemOf = (error: unknown, scope: LetterScope) => {
  const problem = ActionProblem.of(error, KNOWN_ERRORS);
  return problem === 'not_verified' && scope === 'area' ? 'not_verified_area' : problem;
};

/** Pick the letter language (the app's by default), then ask the api for a cited draft of a site or an area. */
export function useLetterRequest<Draft>(send: (language: LetterLanguage) => Promise<Draft>, scope: LetterScope = 'site') {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState<LetterLanguage>(i18n.language === 'hi' ? 'hi' : 'en');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<ReturnType<typeof LetterRefusal.lines>>([]);
  const request = async () => {
    setBusy(true);
    setProblem(null);
    setRefusal([]);
    try {
      setDraft(await send(language));
    } catch (error) {
      setProblem(problemOf(error, scope));
      setRefusal(LetterRefusal.lines(error));
    }
    setBusy(false);
  };
  // The api's not_verified message is English; its counts are shown in the app's own words instead.
  const reason = refusal.length > 0 ? refusal.map((line) => t(`letter.errors.${line.key}`, line.params)).join(' ') : null;
  return { language, setLanguage, draft, busy, problem, reason, request: () => void request(), reset: () => setDraft(null) };
}

export type LetterRequestFlow = Omit<ReturnType<typeof useLetterRequest<unknown>>, 'draft'>;
