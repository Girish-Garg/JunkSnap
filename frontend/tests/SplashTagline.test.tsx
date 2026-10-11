import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplashScreen } from '../src/features/brand/components/SplashScreen';
import { renderApp } from './helpers';

describe('SplashScreen', () => {
  it('says the app is built on AWS under the mark', async () => {
    await renderApp(<SplashScreen onDone={vi.fn()} />);
    expect(screen.getByText('Built on AWS')).toHaveClass('splash__tagline');
  });
});
