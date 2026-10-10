import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { IconButton } from '../../../ui/IconButton';
import { MAP_CARD_ATTRIBUTE } from '../../../ui/TopLayer';
import { ESCAPE_LAYER } from '../../../ui/useEscapeKey';
import { useMapCard } from '../../../ui/useMapCard';
import '../pin-card.css';
import '../site.css';
import { PinCardActions } from './PinCardActions';
import { PinCardSummary } from './PinCardSummary';

interface SitePreviewCardProps {
  readonly site: SiteFeature;
  readonly userLocation: LonLat | null;
  readonly onDetails: (site: SiteFeature) => void;
  /** Closes the card through its history entry (PickedPin's), as back does. */
  readonly onClose: () => void;
  /** Extras the card hosts, such as the site list's PreviewStepper. */
  readonly children?: ReactNode;
}

// Escape reaches the card when it is the top layer; map taps still pass through to the map.
const LAYER = { [ESCAPE_LAYER]: '', [MAP_CARD_ATTRIBUTE]: '' };

/**
 * The compact card after tapping a pin, like a map app's place card: photo, one-line title, status chip, reports and
 * distance, then View site. A tap anywhere on the card opens the site too; close, back, Escape and a swipe down close it.
 */
export function SitePreviewCard({ site, userLocation, onDetails, onClose, children }: SitePreviewCardProps) {
  const { t } = useTranslation();
  const { card, swipe } = useMapCard(onClose);
  const title = t(`reportType.${site.properties.report_type}`);
  // Buttons inside the card do their own thing; a tap anywhere else opens the site, unless it ended a swipe.
  const tap = (event: MouseEvent<HTMLElement>) => {
    const onControl = event.target instanceof Element && event.target.closest('button, a, .preview-stepper') !== null;
    if (!onControl && !swipe.consumedClick(event.timeStamp)) onDetails(site);
  };
  return (
    <section
      ref={card}
      className="preview-card pin-card"
      aria-label={title}
      onClick={tap}
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
      {...LAYER}
    >
      <span className="pin-card__handle" aria-hidden="true" />
      <PinCardSummary site={site} userLocation={userLocation} title={title} />
      <PinCardActions site={site} userLocation={userLocation} onView={() => onDetails(site)} />
      <IconButton icon="close" label={t('preview.close')} onClick={onClose} />
      {children}
    </section>
  );
}
