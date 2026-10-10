import { useTranslation } from 'react-i18next';
import type { SiteStatus } from '../../../domain/Site';

export function StatusBadge({ status }: { readonly status: SiteStatus }) {
  const { t } = useTranslation();
  return <span className={`badge badge--${status}`}>{t(`status.${status}`)}</span>;
}
