import type { ReactNode } from 'react';
import { OnboardingArt, type OnboardingArtName } from '../../../ui/OnboardingArt';

interface OnboardingCardProps {
  readonly art?: OnboardingArtName;
  readonly title: string;
  readonly current: boolean;
  readonly children: ReactNode;
}

/** One card in the deck; cards off screen are hidden from screen readers and the tab order. */
export function OnboardingCard({ art, title, current, children }: OnboardingCardProps) {
  return (
    <article className={current ? 'onboarding-card onboarding-card--current' : 'onboarding-card'} aria-hidden={!current} inert={!current}>
      {art && <OnboardingArt name={art} />}
      <h3 className="onboarding-card__title">{title}</h3>
      {children}
    </article>
  );
}
