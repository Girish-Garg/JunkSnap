import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './photo-cover.css';

interface PhotoCoverProps {
  /** Several people reported the photo; it stays blurred harder until the viewer taps. */
  readonly warned: boolean;
  readonly children: ReactNode;
}

/** Puts a reported photo behind a tap-to-view cover; any other photo shows as it is. */
export function PhotoCover({ warned, children }: PhotoCoverProps) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  if (!warned || shown) return <>{children}</>;
  return (
    <div className="photo-cover">
      <div className="photo-cover__veil" aria-hidden="true" inert>
        {children}
      </div>
      <button
        type="button"
        className="photo-cover__button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setShown(true);
        }}
      >
        <span className="photo-cover__label">
          <strong>{t('photoReport.coverTitle')}</strong>
          <span>{t('photoReport.coverAction')}</span>
        </span>
      </button>
    </div>
  );
}
