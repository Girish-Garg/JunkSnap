import { ToastSlot } from '../../../ui/ToastSlot';
import { useConfirmToast } from '../hooks/useConfirmToast';
import { ConfirmToastCard } from './ConfirmToastCard';

/** App-wide: tells the reporter, once, that the check was unsure about a photo they sent (contracts v1.16). */
export function ConfirmToast() {
  const { ask, dismiss } = useConfirmToast();
  if (ask === null) return null;
  return (
    <ToastSlot>
      <ConfirmToastCard ask={ask} onDismiss={dismiss} />
    </ToastSlot>
  );
}
