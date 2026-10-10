import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import type { AreaScoresState } from '../../areas/hooks/useAreaScores';
import type { AreaHit } from '../BoundaryOverlay';
import { AreaCardLines } from './AreaCardLines';

interface AreaCardBodyProps {
  readonly area: AreaHit;
  readonly state: AreaScoresState;
  readonly pilot: boolean;
  readonly onOpen: () => void;
}

/** The area card's words: name, kind and pilot flag, counts and status, and Open area. */
export function AreaCardBody({ area, state, pilot, onOpen }: AreaCardBodyProps) {
  const { t } = useTranslation();
  return (
    <div className="preview-card__body">
      <p className="preview-card__title">{area.name}</p>
      <p className="preview-card__meta">
        <span>{t(`areas.kind.${area.kind}`)}</span>
        {pilot && <span className="badge">{t('site.pilot')}</span>}
      </p>
      <AreaCardLines state={state} />
      <Button variant="text" onClick={onOpen}>{t('areas.openArea')}</Button>
    </div>
  );
}
