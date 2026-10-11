import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import type { ChipView } from '../../../domain/SiteStatusChip';
import { Icon } from '../../../ui/Icon';
import { useSitePresenter } from '../hooks/useSitePresenter';
import { AskNeighboursButton } from './AskNeighboursButton';
import { StatusExplainer } from './StatusExplainer';

interface ExplainButtonProps {
  readonly site: SiteProperties;
  /** The status to explain: the site's chip, or its backers alone (SiteStatusChip.backing). */
  readonly chip: ChipView;
  readonly className: string;
  readonly children: ReactNode;
}

/**
 * A status that says what it means when tapped: "Waiting · 1 of 10" opens a short explainer. While the site still
 * waits for its 10 people, the explainer offers Ask neighbours to confirm as the next step.
 */
export function ExplainButton({ site, chip, className, children }: ExplainButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const presenter = useSitePresenter(site);
  const asks = presenter.waitsForBackers() && chip.tone === 'waiting';
  return (
    <>
      <button type="button" className={`explain-button ${className}`} aria-haspopup="dialog" title={t('explain.hint')} onClick={() => setOpen(true)}>
        {children}
        <Icon name="info" size={14} />
      </button>
      {open && (
        <StatusExplainer chip={chip} textKey={presenter.explainKey(chip)} onClose={() => setOpen(false)}>
          {asks && <AskNeighboursButton site={site} />}
        </StatusExplainer>
      )}
    </>
  );
}
