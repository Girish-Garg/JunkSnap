import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { MarkerGlyph } from '../../../ui/MarkerGlyph';

interface SiteListItemProps {
  readonly site: SiteFeature;
  readonly onOpen: (site: SiteFeature) => void;
}

export function SiteListItem({ site, onOpen }: SiteListItemProps) {
  const { t } = useTranslation();
  const { report_type: type, status, location } = site.properties;
  return (
    <li>
      <button type="button" className="site-list__item" onClick={() => onOpen(site)}>
        <MarkerGlyph type={type} size={28} />
        <span className="site-list__text">
          <strong>{t(`reportType.${type}`)}</strong>
          <span>
            {t(`status.${status}`)} · {location.town ?? location.state}
          </span>
        </span>
      </button>
    </li>
  );
}
