import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import { NativeBridge } from '../../../services/NativeBridge';

/**
 * Shares a title and a link, with an optional message: the browser's share sheet, else the clipboard (`copied` is
 * true for ui.copiedMs), and inside the Android app the native share sheet with the message (else the title) and link.
 */
export function useShareLink() {
  const { sharer, errors, notifier } = useServices();
  const { copiedMs } = useConfig().ui;
  const native = useMemo(() => new NativeBridge(window), []);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), copiedMs);
    return () => window.clearTimeout(timer);
  }, [copied, copiedMs]);
  const share = useCallback(
    (title: string, url: string, text?: string) => {
      const shared = native.canShareText()
        ? native.shareText(`${text ?? title} ${url}`).then(() => 'shared' as const, () => sharer.copy(url).then(() => 'copied' as const))
        : sharer.share(title, url, text);
      shared.then(
        (result) => setCopied(result === 'copied'),
        // Closing the share sheet is not a failure; anything else is logged and said.
        (error: unknown) => {
          if (errors.report('share', error).category !== 'aborted') notifier.push({ key: 'actions.shareFailed', tone: 'alert' });
        },
      );
    },
    [native, sharer, errors, notifier],
  );
  return { share, copied };
}
