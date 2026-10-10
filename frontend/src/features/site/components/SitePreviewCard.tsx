import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { MAP_CARD_ATTRIBUTE } from '../../../ui/TopLayer';
import { TypeIcon } from '../../../ui/TypeIcon';
import { ESCAPE_LAYER, useEscapeKey } from '../../../ui/useEscapeKey';
import { useDistanceLabel } from '../hooks/useDistanceLabel';
import { useSitePresenter } from '../hooks/useSitePresenter';
import '../site.css';
import { SitePhoto } from './SitePhoto';
import { StatusBadge } from './StatusBadge';

interface SitePreviewCardProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  readonly onDetails: (site: SiteFeature) => void;
  /** Closes the card through its history entry (PickedPin's), as back does. */
  readonly onClose: () => void;
  /** Extras the card hosts, such as the list's PreviewStepper. */
  readonly children?: ReactNode;
}

// Escape reaches the card when it is the top layer; map taps still pass through to the map.
const LAYER = { [ESCAPE_LAYER]: '', [MAP_CARD_ATTRIBUTE]: '' };

/** Compact card after tapping a pin; Details opens the full sheet. Close, back and Escape close it. */
export function SitePreviewCard({ site, userLocation, onDetails, onClose, children }: SitePreviewCardProps) {
  const { t } = useTranslation();
  const card = useRef<HTMLElement>(null);
  useEscapeKey(onClose, card);
  const details = site.properties;
  const [thumbnail, distance] = [useSitePresenter(details).thumbnail(), useDistanceLabel(site, userLocation)];
  return (
    <section ref={card} className="preview-card" aria-label={t(`reportType.${details.report_type}`)} {...LAYER}>
      <ul className="preview-card__thumb">
        <SitePhoto key={thumbnail} url={thumbnail} alt="" />
      </ul>
      <div className="preview-card__body">
        <p className="preview-card__title">
          <span className={`type-chip type-chip--small type-chip--${details.report_type}`}>
            <TypeIcon type={details.report_type} size={22} />
          </span>
          {t(`reportType.${details.report_type}`)}
        </p>
        <p className="preview-card__meta">
          <StatusBadge status={details.status} />
          <span>{t('preview.reports', { count: details.report_count })}</span>
          {distance && <span>{distance}</span>}
        </p>
        <Button variant="text" onClick={() => onDetails(site)}>{t('preview.details')}</Button>
      </div>
      <IconButton icon="close" label={t('preview.close')} onClick={onClose} />
      {children}
    </section>
  );
}
