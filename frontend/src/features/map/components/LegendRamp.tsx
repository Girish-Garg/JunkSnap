import type { LegendStep } from '../ChoroplethScale';

interface LegendRampProps {
  readonly steps: readonly LegendStep[];
  readonly label: string;
}

/** A row of colour steps with what they measure; the low and high end words are in the label. */
export function LegendRamp({ steps, label }: LegendRampProps) {
  return (
    <div className="boundary-legend__ramp">
      <span className="boundary-legend__swatches" aria-hidden="true">
        {steps.map((step) => (
          <span key={step.color} style={{ background: step.color }} />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
