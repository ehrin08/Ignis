import { render } from '@testing-library/react-native';

import { BrandMark } from '@/src/components/brand-mark';

describe('BrandMark', () => {
  test('exposes the default mascot as a labelled image', async () => {
    const result = await render(<BrandMark size={56} />);

    const mark = result.getByTestId('brand-mark-default');
    expect(mark.props.accessibilityLabel).toBe('Ignis ember ledger clerk');
    expect(mark.props.accessibilityRole).toBe('image');
    expect(mark.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 56, height: 56 })]));
  });

  test('supports an inverse surface variant and custom label', async () => {
    const result = await render(<BrandMark variant="inverse" accessibilityLabel="Ignis inverse mascot" />);

    const mark = result.getByTestId('brand-mark-inverse');
    expect(mark.props.accessibilityLabel).toBe('Ignis inverse mascot');
    expect(mark).toBeTruthy();
  });
});
