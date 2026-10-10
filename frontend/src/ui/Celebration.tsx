import { Celebrate } from './Celebrate';
import { SuccessTick } from './SuccessTick';

/** Confetti and the drawn tick together, for something that really worked. */
export function Celebration() {
  return (
    <>
      <Celebrate />
      <SuccessTick />
    </>
  );
}
