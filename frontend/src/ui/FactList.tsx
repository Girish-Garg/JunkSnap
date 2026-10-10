import { Link } from 'react-router';
import { useSheetNavigation } from '../app/useSheetNavigation';

export interface Fact {
  readonly label: string;
  readonly value: string;
  /** In-app path the value links to. */
  readonly to?: string;
}

interface FactListProps {
  readonly title: string;
  readonly facts: readonly Fact[];
}

export function FactList({ title, facts }: FactListProps) {
  const { linkState } = useSheetNavigation();
  return (
    <section className="facts">
      <h3 className="facts__title">{title}</h3>
      <dl className="facts__list">
        {facts.map((fact) => (
          <div key={fact.label} className="facts__row">
            <dt>{fact.label}</dt>
            <dd>{fact.to ? <Link to={fact.to} state={linkState}>{fact.value}</Link> : fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
