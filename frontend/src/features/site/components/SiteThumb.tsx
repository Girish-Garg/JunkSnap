import { useState } from 'react';
import { Icon } from '../../../ui/Icon';

interface SiteThumbProps {
  /** Blurred public copy only, never an original. */
  readonly url: string | null;
  readonly className: string;
}

/** A site's newest blurred photo as a small rounded tile; a missing or broken photo shows the photo icon. */
export function SiteThumb({ url, className }: SiteThumbProps) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={className} aria-hidden="true">
      {url && !broken ? <img src={url} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} /> : <Icon name="photo" size={20} />}
    </span>
  );
}
