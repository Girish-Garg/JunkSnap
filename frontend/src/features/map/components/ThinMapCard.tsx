import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../../ui/IconButton';
import { Illustration } from '../../../ui/Illustration';
import { useCardHeight } from '../../../ui/useCardHeight';
import type { MapPageState } from '../hooks/useMapPage';
import { useThinActions, type ThinActions } from '../hooks/useThinActions';
import { useThinCard } from '../hooks/useThinCard';
import { ThinNote } from './ThinNote';

const TITLE_ID = 'thin-card-title';

/** Phones: a small card on the map foot while the view holds few or no sites, so a quiet map reads as a start. */
export function ThinMapCard({ page }: { readonly page: MapPageState }) {
  const { shown, dismiss } = useThinCard(page);
  const actions = useThinActions(page);
  if (!shown) return null;
  return <ThinCard count={shown.count} actions={actions} onDismiss={dismiss} />;
}

interface ThinCardProps {
  readonly count: number;
  readonly actions: ThinActions;
  readonly onDismiss: () => void;
}

// Publishes its height, so the map buttons and the legend stand on it (thin.css).
function ThinCard({ count, actions, onDismiss }: ThinCardProps) {
  const { t } = useTranslation();
  const card = useRef<HTMLElement>(null);
  useCardHeight(card);
  return (
    <section ref={card} className="thin-card" aria-labelledby={TITLE_ID}>
      <Illustration name="clean" size={48} />
      <ThinNote count={count} actions={actions} titleId={TITLE_ID} />
      <IconButton icon="close" label={t('thin.dismiss')} onClick={onDismiss} />
    </section>
  );
}
