import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVAILABLE } from '../src/domain/ActionAvailability';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { useLocationHelp } from '../src/features/actions/hooks/useLocationHelp';
import { STEP_TOAST_MS, TOAST_MS } from '../src/features/actions/hooks/useToast';
import { Notifier } from '../src/services/Notifier';
import { renderApp, testServices } from './helpers';

const OFF = "Your phone's location is off. Turn it on and try again.";
const OFFLINE = "You're offline. Try again once you're connected.";
const STEP = { key: 'location.off', action: { key: 'snap.tryAgain', run: () => undefined } };

afterEach(() => {
  vi.useRealTimers();
});

// The app toast alone, on timers the test moves; withStep() shows a toast with a Try again step.
async function toasts() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const services = testServices();
  const run = vi.fn();
  await renderApp(<ToastHost />, { services });
  const withStep = () => act(() => void services.notifier.push({ key: 'location.off', action: { key: 'snap.tryAgain', run } }));
  return { services, run, withStep, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
}

describe('a toast with a step', () => {
  it('stays, with its close button, until the next line replaces it; a plain line still leaves after TOAST_MS', async () => {
    const { services, withStep } = await toasts();
    withStep();
    act(() => vi.advanceTimersByTime(TOAST_MS * 3));
    expect(screen.getByText(OFF)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    act(() => void services.notifier.push({ key: 'gate.offline' }));
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
  });

  it('leaves when its step is taken or it is closed', async () => {
    const { run, withStep, user } = await toasts();
    withStep();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
    withStep();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
    expect(run).toHaveBeenCalledOnce();
  });
});

describe('a toast with a step nobody uses', () => {
  it('leaves by itself after STEP_TOAST_MS when nobody uses it', async () => {
    const { withStep } = await toasts();
    withStep();
    act(() => vi.advanceTimersByTime(STEP_TOAST_MS - 1));
    expect(screen.getByText(OFF)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
  });
});

// A sheet's location help, which the test closes as the person would close the sheet.
function SheetWithHelp() {
  const [open, setOpen] = useState(true);
  return open ? <HelpButtons onClose={() => setOpen(false)} /> : null;
}

function HelpButtons({ onClose }: { readonly onClose: () => void }) {
  const help = useLocationHelp();
  return (
    <>
      <button type="button" onClick={() => help('unavailable', AVAILABLE, () => undefined)}>
        Need help
      </button>
      <button type="button" onClick={onClose}>
        Close sheet
      </button>
    </>
  );
}

describe('location help when its sheet closes', () => {
  it('leaves with the sheet, so its Try again never acts for a site that is gone', async () => {
    const user = userEvent.setup();
    await renderApp(<><SheetWithHelp /><ToastHost /></>, { services: testServices() });
    await user.click(screen.getByRole('button', { name: 'Need help' }));
    expect(screen.getByText(OFF)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close sheet' }));
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
  });
});

describe('the toast queue with step toasts', () => {
  // A plain line, then a step toast behind it, then another plain line.
  function queued(): Notifier {
    const notifier = new Notifier();
    notifier.push({ key: 'gate.busy' });
    notifier.push(STEP);
    notifier.push({ key: 'gate.offline' });
    return notifier;
  }

  it('drops a step toast still waiting when a new line comes, so the lines behind it are not stuck', () => {
    const notifier = queued();
    notifier.dismiss(notifier.current()?.id ?? 0);
    expect(notifier.current()?.key).toBe('gate.offline');
  });

  it('never shows the same line twice in a row', () => {
    const notifier = queued();
    notifier.dismiss(notifier.current()?.id ?? 0);
    notifier.push({ key: 'gate.offline' });
    notifier.dismiss(notifier.current()?.id ?? 0);
    expect(notifier.current()).toBeNull();
  });
});
