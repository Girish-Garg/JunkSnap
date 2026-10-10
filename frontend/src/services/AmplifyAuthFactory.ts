import {
  confirmResetPassword,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from '@aws-amplify/auth';
import { cognitoUserPoolsTokenProvider } from '@aws-amplify/auth/cognito';
import { Amplify } from '@aws-amplify/core';
import type { CognitoConfig } from '../app/AppConfig';
import { AmplifyAuthService } from './AmplifyAuthService';

/** Configures Amplify once for the stage's user pool; tokens live in localStorage, Amplify's default. */
export class AmplifyAuthFactory {
  static build({ userPoolId, clientId }: CognitoConfig): AmplifyAuthService {
    const Cognito = { userPoolId, userPoolClientId: clientId, loginWith: { email: true }, signUpVerificationMethod: 'code' as const };
    cognitoUserPoolsTokenProvider.setAuthConfig({ Cognito });
    Amplify.configure({ Auth: { Cognito } }, { Auth: { tokenProvider: cognitoUserPoolsTokenProvider } });
    return new AmplifyAuthService({
      signIn,
      signUp,
      confirmSignUp,
      resendSignUpCode,
      resetPassword,
      confirmResetPassword,
      signOut,
      fetchAuthSession,
    });
  }
}
