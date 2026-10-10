import { useTranslation } from 'react-i18next';
import type { Blocked } from '../../../domain/ActionAvailability';
import { RouteLocked } from '../../actions/components/RouteLocked';
import type { LetterRequestFlow } from '../hooks/useLetterRequest';
import { LetterChooser } from './LetterChooser';

interface LetterStartProps {
  readonly flow: LetterRequestFlow;
  /** Why this letter cannot be drafted (a link to a site not verified or off the map); null when it can. */
  readonly locked: Blocked | null;
  readonly onBack: () => void;
}

/** Before a draft: the language chooser, or why there is no letter to draft here. */
export function LetterStart({ flow, locked, onBack }: LetterStartProps) {
  const { t } = useTranslation();
  if (locked) return <RouteLocked reason={locked} backLabel={t('gate.back')} onBack={onBack} />;
  return <LetterChooser flow={flow} />;
}
