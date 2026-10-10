import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { useServices } from '../../../app/useServices';
import { IconButton } from '../../../ui/IconButton';
import { ESCAPE_LAYER, useEscapeKey } from '../../../ui/useEscapeKey';
import { useInertOutside } from '../../../ui/useInertOutside';
import { useSheetFocus } from '../../../ui/useSheetFocus';
import { useCardDeck } from '../hooks/useCardDeck';
import '../onboarding.css';
import { CARD_COUNT, OnboardingCards } from './OnboardingCards';
import { OnboardingFooter } from './OnboardingFooter';

const TITLE_ID = 'onboarding-title';

/** "How JunkSnap works": swipeable cards over the map, shown once by themselves and again from Account. */
export function OnboardingRoute() {
  const { t } = useTranslation();
  const { onboarding } = useServices();
  const sheets = useSheetNavigation();
  const [track, deck] = useCardDeck(CARD_COUNT);
  const layer = useRef<HTMLElement>(null);
  // Seen only once the reader closes the cards (Explore, Skip, the close button or Escape), not when they open.
  const close = useCallback(() => {
    onboarding.markSeen();
    sheets.close('/');
  }, [onboarding, sheets]);
  useEscapeKey(close, layer);
  useInertOutside(layer);
  useSheetFocus(TITLE_ID, null);
  return (
    <section ref={layer} className="onboarding" role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} {...{ [ESCAPE_LAYER]: '' }}>
      <header className="onboarding__head">
        <h2 id={TITLE_ID} className="onboarding__label" tabIndex={-1}>
          {t('onboarding.label')}
        </h2>
        <IconButton icon="close" label={t('onboarding.skip')} onClick={close} />
      </header>
      <div ref={track} className="onboarding__track" onScroll={deck.onScroll}>
        <OnboardingCards index={deck.index} />
      </div>
      <OnboardingFooter deck={deck} onClose={close} />
    </section>
  );
}
