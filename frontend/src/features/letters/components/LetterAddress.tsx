import type { LetterDraft } from '../../../domain/SiteActions';
import type { LetterText } from '../LetterText';

/** To, Cc for attention and subject: offices and seats only, never a person. */
export function LetterAddress({ draft, text }: { readonly draft: LetterDraft; readonly text: LetterText }) {
  return (
    <dl className="letter__address">
      <div>
        <dt>{text.label('to')}</dt>
        <dd>{text.to()}</dd>
      </div>
      {draft.cc.length > 0 && (
        <div>
          <dt>{text.label('ccLabel')}</dt>
          {draft.cc.map((cc) => (
            <dd key={cc.seat.id}>{text.cc(cc)}</dd>
          ))}
        </div>
      )}
      <div>
        <dt>{text.label('subject')}</dt>
        <dd className="letter__subject">{draft.subject}</dd>
      </div>
    </dl>
  );
}
