import { JunkSnapError } from "../errors.js";

// The bytes are not a decodable image; moderation turns this into the invalid_image reason.
export class InvalidImageError extends JunkSnapError {}
