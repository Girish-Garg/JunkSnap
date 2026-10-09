import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { LanguageSwitch } from '../../../ui/LanguageSwitch';
import { useEscapeKey } from '../../../ui/useEscapeKey';

interface AppMenuProps {
  readonly sampleData: boolean;
}

export function AppMenu({ sampleData }: AppMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEscapeKey(close, open);
  return (
    <div className="menu">
      <IconButton icon="menu" label={t('menu.open')} onClick={() => setOpen(!open)} expanded={open} />
      {open && <div className="menu__backdrop" onClick={close} />}
      {open && (
        <div className="menu__panel" role="dialog" aria-label={t('menu.title')}>
          <p className="menu__heading">{t('language.label')}</p>
          <LanguageSwitch />
          <p className="menu__note">
            <Icon name="info" size={20} />
            {t(sampleData ? 'menu.sampleNote' : 'menu.liveNote')}
          </p>
        </div>
      )}
    </div>
  );
}
