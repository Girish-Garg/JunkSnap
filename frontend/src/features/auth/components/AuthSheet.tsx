import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../../ui/BottomSheet';
import type { AuthStep } from '../AuthFlowContext';
import { useAuthFlow } from '../hooks/useAuthFlow';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { VerifyEmailForm } from './VerifyEmailForm';

import { AUTH_TITLE_ID } from './authIds';

// One form per step; adding a step adds an entry here.
const FORMS: Readonly<Record<AuthStep, () => ReactNode>> = {
  signIn: () => <SignInForm />,
  signUp: () => <SignUpForm />,
  verify: () => <VerifyEmailForm />,
  forgot: () => <ForgotPasswordForm />,
};

export function AuthSheet() {
  const { t } = useTranslation();
  const flow = useAuthFlow();
  if (!flow.step) return null;
  return (
    <BottomSheet
      key={flow.step}
      labelledBy={AUTH_TITLE_ID}
      closeLabel={t('auth.close')}
      resizeLabel={t('sheet.resize')}
      onClose={flow.close}
      initial="full"
    >
      {FORMS[flow.step]()}
    </BottomSheet>
  );
}
