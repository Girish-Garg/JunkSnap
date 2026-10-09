export interface Fact {
  readonly label: string;
  readonly value: string;
}

interface FactListProps {
  readonly title: string;
  readonly facts: readonly Fact[];
}

export function FactList({ title, facts }: FactListProps) {
  return (
    <section className="facts">
      <h3 className="facts__title">{title}</h3>
      <dl className="facts__list">
        {facts.map((fact) => (
          <div key={fact.label} className="facts__row">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
