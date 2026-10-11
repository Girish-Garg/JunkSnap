import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import type { LetterDraft } from '../../../domain/SiteActions';

interface UnverifiedNoteProps {
  readonly site: SiteFeature | null;
  readonly draft: LetterDraft | null;
  /** The sheet says why there is no letter instead. */
  readonly locked: boolean;
}

/** Decision 20261011-1750: an unverified site takes a letter too, and the letter says how many people backed it. */
export function UnverifiedNote({ site, draft, locked }: UnverifiedNoteProps) {
  const { t } = useTranslation();
  const verification = draft?.evidence?.verification ?? site?.properties.verification;
  if (locked || verification !== 'unverified') return null;
  return <p className="form__note">{t('letter.unverifiedNote')}</p>;
}
