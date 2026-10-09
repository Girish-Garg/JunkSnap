import { JunkSnapError } from './JunkSnapError';

export type LocationProblem = 'denied' | 'unavailable';

export class LocationError extends JunkSnapError {
  readonly problem: LocationProblem;

  constructor(problem: LocationProblem, message: string) {
    super(message);
    this.problem = problem;
  }
}
