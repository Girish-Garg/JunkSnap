import { useTranslation } from 'react-i18next';
import type { LetterLanguage } from '../../../domain/SiteActions';
import { Button } from '../../../ui/Button';
import { Segmented } from '../../../ui/Segmented';
import type { LetterFlow } from '../hooks/useLetter';

const LANGUAGES: readonly { readonly value: LetterLanguage; readonly label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
];

/** Before drafting: the letter's language and what happens next. */
export function LetterChooser({ flow }: { readonly flow: LetterFlow }) {
  const { t } = useTranslation();
  return (
    <div className="form">
      <p className="sheet-text">{t('letter.intro')}</p>
      <Segmented label={t('letter.language')} options={LANGUAGES} value={flow.language} onChange={flow.setLanguage} />
      {flow.problem && (
        <p className="form__error" role="alert">
          {t(`letter.errors.${flow.problem}`)}
        </p>
      )}
      <Button onClick={flow.request} disabled={flow.busy}>
        {t(flow.busy ? 'letter.drafting' : 'letter.draft')}
      </Button>
      {flow.busy && <p className="form__note">{t('letter.wait')}</p>}
    </div>
  );
}
