import './illustration.css';

/** The sunny tick that draws itself when something worked. */
export function SuccessTick() {
  return (
    <span className="success-tick" aria-hidden="true">
      <svg width="36" height="36" viewBox="0 0 24 24">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}
