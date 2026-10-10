import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import type { SiteCommunity } from '../../../domain/Community';
import { SITE_GATES, type SiteActionFacts } from '../../../domain/SiteActionGates';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';
import { CommunityPresenter } from '../CommunityPresenter';
import { SiteNoteForm } from './SiteNoteForm';
import '../community.css';

interface SiteNotesProps {
  readonly siteId: string;
  readonly community: SiteCommunity | null | undefined;
  readonly facts: SiteActionFacts;
  readonly onChanged: () => void;
}

const TITLE_ID = 'site-notes-title';

/** Notes from residents: a neutral summary and signal chips from moderated notes; never a note's author. */
export function SiteNotes({ siteId, community, facts, onChanged }: SiteNotesProps) {
  const { t, i18n } = useTranslation();
  const gate = useGate();
  const add = SITE_GATES.note.decide(facts);
  const [adding, setAdding] = useState(false);
  const presenter = community ? new CommunityPresenter(community) : null;
  return (
    <section className="site-notes" aria-labelledby={TITLE_ID}>
      <h3 id={TITLE_ID} className="site-notes__title">{t('notes.title')}</h3>
      {presenter && community ? (
        <>
          <p className="site-notes__summary">{presenter.summary(i18n.language)}</p>
          <p className="site-notes__meta">{t('notes.from', { people: community.people, notes: community.notes_count })}</p>
          <ul className="site-notes__chips" aria-label={t('notes.signalsLabel')}>
            {presenter.chips().map((chip) => (
              <li key={chip.key} className="site-notes__chip">{t(chip.key, chip.values)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="site-notes__meta">{t('notes.empty')}</p>
      )}
      {adding ? (
        <SiteNoteForm siteId={siteId} facts={facts} onAdded={onChanged} />
      ) : (
        <Button variant="text" onClick={gate(add, () => setAdding(true))} blocked={lookOf(add).blocked}>{t('notes.add')}</Button>
      )}
    </section>
  );
}
