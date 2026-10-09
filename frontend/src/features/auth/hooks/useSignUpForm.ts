import { useState, type FormEvent } from 'react';
import { useServices } from '../../../app/useServices';
import { Credentials } from '../../../domain/Credentials';
import { AuthValidator, type FieldErrors } from '../AuthValidator';
import { useAuthFlow } from './useAuthFlow';
import { useSubmit } from './useSubmit';

export function useSignUpForm() {
  const { auth } = useServices();
  const flow = useAuthFlow();
  const [email, setEmail] = useState(flow.email);
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useSubmit();
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found = AuthValidator.signUp(email, password, terms);
    setErrors(found);
    if (!AuthValidator.isValid(found)) return;
    void submit.run(async () => {
      await auth.signUp(email, password);
      flow.go('verify', email);
    });
  };
  const strength = password ? Credentials.strength(password) : null;
  return { flow, email, setEmail, password, setPassword, terms, setTerms, errors, strength, submit, onSubmit };
}
