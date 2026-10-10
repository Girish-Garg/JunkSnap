import { createPortal } from 'react-dom';
import type { AreaLetterDraft } from '../../../domain/AreaLetter';
import type { LetterText } from '../LetterText';
import { AreaEvidence } from './AreaEvidence';
import { LetterActions } from './LetterActions';
import { LetterView } from './LetterView';

interface AreaLetterDraftViewProps {
  readonly draft: AreaLetterDraft;
  readonly onReset: () => void;
}

/** The drafted area letter on screen, its actions, and the print-only copy. */
export function AreaLetterDraftView({ draft, onReset }: AreaLetterDraftViewProps) {
  const evidence = (text: LetterText) => <AreaEvidence evidence={draft.evidence} text={text} language={draft.language} />;
  return (
    <>
      <LetterView draft={draft} evidence={evidence} />
      <LetterActions draft={draft} onReset={onReset} />
      {createPortal(<LetterView draft={draft} evidence={evidence} forPrint />, document.body)}
    </>
  );
}
