import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { NativeBridge } from '../../../services/NativeBridge';

const COPIED_MS = 2500;

/**
 * Shares a title and a link: the browser's share sheet, else the clipboard (`copied` is true for a
 * moment), and inside the Android app the native share sheet with the title and the link.
 */
export function useShareLink() {
  const { sharer, errors, notifier } = useServices();
  const native = useMemo(() => new NativeBridge(window), []);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const share = useCallback(
    (title: string, url: string) => {
      const shared = native.canShareText()
        ? native.shareText(`${title} ${url}`).then(() => 'shared' as const, () => sharer.copy(url).then(() => 'copied' as const))
        : sharer.share(title, url);
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
