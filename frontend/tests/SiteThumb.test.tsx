import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteThumb } from '../src/features/site/components/SiteThumb';

const A = 'https://cdn.test/media/reports/rpt_a.jpg';
const B = 'https://cdn.test/media/reports/rpt_b.jpg';

describe('SiteThumb', () => {
  it('shows the photo icon for a broken photo, and tries the next site\'s photo afresh', () => {
    const { container, rerender } = render(<SiteThumb url={A} className="thumb" />);
    const first = container.querySelector('img');
    if (!first) throw new Error('no photo');
    fireEvent.error(first);
    expect(container.querySelector('img')).toBeNull();
    rerender(<SiteThumb url={B} className="thumb" />);
    expect(container.querySelector('img')).toHaveAttribute('src', B);
  });
});
