import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthError } from '../../../domain/AuthError';

/** Runs one auth call at a time and turns its failure into a translated message. */
export function useSubmit() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>, onProblem?: (error: AuthError) => boolean) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      const problem = caught instanceof AuthError ? caught.problem : 'unknown';
      const handled = caught instanceof AuthError && onProblem?.(caught);
      if (!handled) setError(t(`auth.errors.${problem}`));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
