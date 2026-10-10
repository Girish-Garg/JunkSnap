import { useTranslation } from 'react-i18next';
import type { Blocked } from '../../../domain/ActionAvailability';
import { Button } from '../../../ui/Button';
import { Notice } from '../../../ui/Notice';
import '../actions.css';

interface RouteLockedProps {
  readonly reason: Blocked;
  readonly backLabel: string;
  readonly onBack: () => void;
}

/** A sheet opened by link for an action that cannot run here: why, and the way back, instead of a form that would fail. */
export function RouteLocked({ reason, backLabel, onBack }: RouteLockedProps) {
  const { t } = useTranslation();
  return (
    <div className="route-locked">
      <Notice icon="info" text={t(reason.reason, reason.params)} />
      <Button variant="secondary" onClick={onBack}>
        {backLabel}
      </Button>
    </div>
  );
}
