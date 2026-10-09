import { ValidationError } from "../errors.js";

// No Lok Sabha seat contains the point, or the geocoder places it in another country.
export class OutsideIndiaError extends ValidationError {}
