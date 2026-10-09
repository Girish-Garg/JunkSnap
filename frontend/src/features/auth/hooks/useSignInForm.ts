import { useState, type FormEvent } from 'react';
import { useServices } from '../../../app/useServices';
import { AuthValidator, type FieldErrors } from '../AuthValidator';
import { useAuthFlow } from './useAuthFlow';
import { useSubmit } from './useSubmit';

export function useSignInForm() {
  const { auth } = useServices();
  const flow = useAuthFlow();
  const [email, setEmail] = useState(flow.email);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useSubmit();
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = AuthValidator.signIn(email, password);
    setErrors(found);
    if (!AuthValidator.isValid(found)) return;
    void submit.run(
      async () => {
        await auth.signIn(email, password);
        flow.finish();
      },
      // An unverified account goes to the code step instead of showing an error.
      (error) => error.problem === 'not_confirmed' && (flow.go('verify', email), true),
    );
  };
  return { email, setEmail, password, setPassword, errors, submit, onSubmit, flow };
}
