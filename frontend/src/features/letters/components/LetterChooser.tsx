import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { LETTER_DRAFT_GATE } from '../../../domain/SiteActionGates';
import type { LetterLanguage } from '../../../domain/SiteActions';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';
import { useSessionFacts } from '../../actions/hooks/useSessionFacts';
import { Segmented } from '../../../ui/Segmented';
import type { LetterRequestFlow } from '../hooks/useLetterRequest';
import { LogoLoader } from '../../../ui/LogoLoader';

const LANGUAGES: readonly { readonly value: LetterLanguage; readonly label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
];

/** Before drafting: the letter's language and what happens next. */
export function LetterChooser({ flow }: { readonly flow: LetterRequestFlow }) {
  const { t } = useTranslation();
  const gate = useGate();
  const draftable = LETTER_DRAFT_GATE.decide({ ...useSessionFacts(), busy: flow.busy });
  return (
    <div className="form">
      <p className="sheet-text">{t('letter.intro')}</p>
      <Segmented label={t('letter.language')} options={LANGUAGES} value={flow.language} onChange={flow.setLanguage} />
      {flow.problem && (
        <p className="form__error" role="alert">
          {flow.reason ?? t(`letter.errors.${flow.problem}`)}
        </p>
      )}
      <Button onClick={gate(draftable, flow.request)} {...lookOf(draftable)}>
        {t(flow.busy ? 'letter.drafting' : 'letter.draft')}
      </Button>
      {flow.busy && <LogoLoader text={t('letter.wait')} />}
    </div>
  );
}
