import { useEffect, useState } from 'react';

type PermissionKind = 'geolocation' | 'camera';

/** granted, denied or prompt as the browser reports it; unknown while it answers or where the API is missing. */
export type PermissionAnswer = PermissionState | 'unknown';

/** The browser's answer for one permission, kept current as the person changes it. */
export function usePermissionState(kind: PermissionKind): PermissionAnswer {
  const [answer, setAnswer] = useState<PermissionAnswer>('unknown');
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let current = true;
    const update = () => setAnswer(status?.state ?? 'unknown');
    // Not every browser knows every name (Firefox has no camera); a refused query stays "unknown".
    navigator.permissions
      ?.query({ name: kind as PermissionName })
      .then((reply) => {
        if (!current) return;
        status = reply;
        update();
        reply.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      current = false;
      status?.removeEventListener('change', update);
    };
  }, [kind]);
  return answer;
}
