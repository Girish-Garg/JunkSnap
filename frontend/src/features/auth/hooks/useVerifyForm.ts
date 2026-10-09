import { useState, type FormEvent } from 'react';
import { useServices } from '../../../app/useServices';
import { AuthValidator, type FieldErrors } from '../AuthValidator';
import { useAuthFlow } from './useAuthFlow';
import { useCountdown } from './useCountdown';
import { useSubmit } from './useSubmit';

export const RESEND_SECONDS = 30;

export function useVerifyForm() {
  const { auth } = useServices();
  const flow = useAuthFlow();
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useSubmit();
  const countdown = useCountdown(RESEND_SECONDS);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = AuthValidator.code(code);
    setErrors(found);
    if (!AuthValidator.isValid(found)) return;
    void submit.run(async () => {
      await auth.confirmSignUp(flow.email, code);
      flow.finish();
    });
  };
  const resend = () => {
    countdown.restart();
    void submit.run(() => auth.resendCode(flow.email));
  };
  const digitsOnly = (value: string) => setCode(value.replace(/\D/g, ''));
  return { email: flow.email, code, setCode: digitsOnly, errors, submit, onSubmit, resend, left: countdown.left, sampleCode: auth.sampleCode() };
}
