import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import type { CardDeck } from '../hooks/useCardDeck';

interface OnboardingFooterProps {
  readonly deck: CardDeck;
  readonly onClose: () => void;
}

/** Skip, the dots (each jumps to its card), and Next; the last card's button closes the deck. */
export function OnboardingFooter({ deck, onClose }: OnboardingFooterProps) {
  const { t } = useTranslation();
  const dots = Array.from({ length: deck.count }, (_, i) => i);
  return (
    <footer className="onboarding__footer">
      <Button variant="text" onClick={onClose}>
        {t('onboarding.skip')}
      </Button>
      <div className="onboarding__dots">
        {dots.map((i) => (
          <button
            key={i}
            type="button"
            className="onboarding__dot"
            aria-label={t('onboarding.step', { n: i + 1, total: deck.count })}
            aria-current={i === deck.index ? 'step' : undefined}
            onClick={() => deck.go(i)}
          />
        ))}
      </div>
      <Button onClick={deck.last ? onClose : () => deck.go(deck.index + 1)}>{t(deck.last ? 'onboarding.done' : 'onboarding.next')}</Button>
    </footer>
  );
}
