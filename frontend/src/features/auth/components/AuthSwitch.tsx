import { Button } from '../../../ui/Button';

interface AuthSwitchProps {
  readonly question: string;
  readonly action: string;
  readonly onClick: () => void;
}

export function AuthSwitch({ question, action, onClick }: AuthSwitchProps) {
  return (
    <p className="form__row">
      {question}
      <Button variant="text" onClick={onClick}>
        {action}
      </Button>
    </p>
  );
}
