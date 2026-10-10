import { useEffect, useState } from 'react';

type PermissionKind = 'geolocation' | 'camera';

/** True once the browser says the person blocked this permission; false while unknown or where the API is missing. */
export function usePermissionDenied(kind: PermissionKind): boolean {
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let current = true;
    const update = () => setDenied(status?.state === 'denied');
    // Not every browser knows every name (Firefox has no camera); a refused query means "unknown".
    navigator.permissions
      ?.query({ name: kind as PermissionName })
      .then((answer) => {
        if (!current) return;
        status = answer;
        update();
        answer.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      current = false;
      status?.removeEventListener('change', update);
    };
  }, [kind]);
  return denied;
}
