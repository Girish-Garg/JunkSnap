import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { AuthValidator, type FieldErrors } from '../AuthValidator';
import { useAuthFlow } from './useAuthFlow';
import { useSubmit } from './useSubmit';

/** Two phases: email, then code and new password. */
export function useForgotForm() {
  const { t } = useTranslation();
  const { auth } = useServices();
  const flow = useAuthFlow();
  const [phase, setPhase] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(flow.email);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useSubmit();
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = phase === 'email' ? AuthValidator.email(email) : AuthValidator.reset(code, password);
    setErrors(found);
    if (!AuthValidator.isValid(found)) return;
    const done = () => flow.go('signIn', email, t('auth.forgot.done'));
    void submit.run(async () => {
      if (phase === 'email') await auth.forgotPassword(email).then(() => setPhase('reset'));
      else await auth.resetPassword(email, code, password).then(done);
    });
  };
  return { flow, phase, email, setEmail, code, setCode, password, setPassword, errors, submit, onSubmit, sampleCode: auth.sampleCode() };
}
