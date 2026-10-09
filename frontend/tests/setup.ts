import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no object URLs; the Snap review preview uses them.
if (typeof URL.createObjectURL !== 'function') {
  Object.assign(URL, { createObjectURL: () => 'blob:test-photo', revokeObjectURL: () => undefined });
}

afterEach(() => cleanup());
