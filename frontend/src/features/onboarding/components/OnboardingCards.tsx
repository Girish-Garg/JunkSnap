import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useAuthUser } from '../../auth/hooks/useAuthUser';
import { OnboardingCard } from './OnboardingCard';
import { ResponsibilityChain } from './ResponsibilityChain';

export const CARD_COUNT = 4;

/** Why, how, who looks after a site, and scores plus sign-in. Short and warm; no blame, no parties. */
export function OnboardingCards({ index }: { readonly index: number }) {
  const { t } = useTranslation();
  const auth = useAuthFlow();
  const user = useAuthUser();
  const steps = t('onboarding.how.steps', { returnObjects: true }) as unknown;
  return (
    <>
      <OnboardingCard art="causes" title={t('onboarding.why.title')} current={index === 0}>
        <p className="onboarding-card__text">{t('onboarding.why.text')}</p>
      </OnboardingCard>
      <OnboardingCard art="pipeline" title={t('onboarding.how.title')} current={index === 1}>
        <ol className="onboarding-steps">
          {(Array.isArray(steps) ? steps : []).map((step: string) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </OnboardingCard>
      <OnboardingCard title={t('onboarding.chain.title')} current={index === 2}>
        <p className="onboarding-card__text">{t('onboarding.chain.text')}</p>
        <ResponsibilityChain />
        <p className="onboarding-card__note">{t('onboarding.chain.letter')}</p>
      </OnboardingCard>
      <OnboardingCard art="scores" title={t('onboarding.start.title')} current={index === 3}>
        <p className="onboarding-card__text">{t('onboarding.start.scores')}</p>
        <p className="onboarding-card__text">{t('onboarding.start.text')}</p>
        {!user && <Button variant="sun" onClick={() => auth.go('signIn')}>{t('onboarding.signIn')}</Button>}
      </OnboardingCard>
    </>
  );
}
