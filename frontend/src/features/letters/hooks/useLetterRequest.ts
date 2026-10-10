import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../domain/ApiError';
import type { LetterLanguage } from '../../../domain/SiteActions';
import { ActionProblem } from '../../site/ActionProblem';

// Error codes from the letter routes with their own message.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['not_verified', 'no_local_body', 'rate_limited', 'not_found', 'area_not_found']);

const problemOf = (error: unknown) => ActionProblem.of(error, KNOWN_ERRORS);

// A 409 not_verified explains itself (how many people reported no bin, how many verified reports an issue has); show it as sent.
const reasonOf = (error: unknown) => (error instanceof ApiError && error.code === 'not_verified' && error.message ? error.message : null);

/** Pick the letter language (the app's by default), then ask the api for a cited draft of a site or an area. */
export function useLetterRequest<Draft>(send: (language: LetterLanguage) => Promise<Draft>) {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<LetterLanguage>(i18n.language === 'hi' ? 'hi' : 'en');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const request = async () => {
    setBusy(true);
    setProblem(null);
    setReason(null);
    try {
      setDraft(await send(language));
    } catch (error) {
      setProblem(problemOf(error));
      setReason(reasonOf(error));
    } finally {
      setBusy(false);
    }
  };
  return { language, setLanguage, draft, busy, problem, reason, request: () => void request(), reset: () => setDraft(null) };
}

export type LetterRequestFlow = Omit<ReturnType<typeof useLetterRequest<unknown>>, 'draft'>;
