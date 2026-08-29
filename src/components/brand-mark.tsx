import { Image, StyleSheet } from 'react-native';

export type BrandMarkProps = {
  size?: number;
  /** Use this on graphite or similarly strong surfaces. */
  variant?: 'default' | 'inverse';
  accessibilityLabel?: string;
};

/** Ignis's ember ledger clerk, shared with the launcher artwork. */
export function BrandMark({
  size = 40,
  variant = 'default',
  accessibilityLabel = 'Ignis ember ledger clerk',
}: BrandMarkProps) {
  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      source={require('../../assets/images/mascot-icon.png')}
      style={[styles.mark, { width: size, height: size }, variant === 'inverse' ? styles.inverse : undefined]}
      testID={`brand-mark-${variant}`}
    />
  );
}

const styles = StyleSheet.create({
  mark: { resizeMode: 'contain' },
  inverse: { opacity: 0.9 },
});
