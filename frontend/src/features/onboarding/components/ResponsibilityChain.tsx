import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../../../ui/Icon';

// Offices only, in the order a site's letter goes: never a person's name, never a party.
const LINKS: readonly { readonly key: string; readonly icon: IconName }[] = [
  { key: 'you', icon: 'camera' },
  { key: 'body', icon: 'cleaned' },
  { key: 'councillor', icon: 'account' },
  { key: 'mla', icon: 'areas' },
  { key: 'mp', icon: 'map' },
];

export function ResponsibilityChain() {
  const { t } = useTranslation();
  return (
    <ol className="chain">
      {LINKS.map(({ key, icon }) => (
        <li key={key} className={`chain__link chain__link--${key}`}>
          <span className="chain__icon">
            <Icon name={icon} size={20} />
          </span>
          <span className="chain__text">
            <strong>{t(`onboarding.chain.${key}`)}</strong>
            <span>{t(`onboarding.chain.${key}Text`)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
