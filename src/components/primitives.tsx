import { MaterialIcons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { displayFont, displayFontStrong, radii, spacing, useIgnisTheme } from '@/src/theme/tokens';

export type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
  testID?: string;
}>;

export function Screen({
  children,
  scroll = false,
  contentStyle,
  onRefresh,
  refreshing: controlledRefreshing,
  testID,
}: ScreenProps) {
  const theme = useIgnisTheme();
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const isRefreshing = controlledRefreshing ?? internalRefreshing;

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    if (controlledRefreshing === undefined) {
      setInternalRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setInternalRefreshing(false);
      }
    } else {
      await onRefresh();
    }
  }, [controlledRefreshing, onRefresh]);

  const refreshControl = onRefresh ? (
    <RefreshControl
      colors={[theme.colors.accent]}
      tintColor={theme.colors.accent}
      progressBackgroundColor={theme.colors.surfaceRaised}
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      testID="screen-refresh-control"
    />
  ) : undefined;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      testID={testID ?? 'screen-scroll-view'}>
      {children}
    </ScrollView>
  ) : <View style={[styles.content, contentStyle]} testID={testID}>{children}</View>;
  return <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.colors.background }]}>{body}</SafeAreaView>;
}

export function AppText({ children, variant = 'body', style, ...props }: PropsWithChildren<{
  variant?: 'display' | 'displayStrong' | 'title' | 'body' | 'label' | 'muted';
  style?: StyleProp<TextStyle>;
}> & React.ComponentProps<typeof Text>) {
  const theme = useIgnisTheme();
  return (
    <Text
      maxFontSizeMultiplier={variant.startsWith('display') ? 1.35 : 1.6}
      style={[
        styles.text,
        { color: theme.colors.ink },
        variant === 'display' && styles.display,
        variant === 'displayStrong' && styles.displayStrong,
        variant === 'title' && styles.title,
        variant === 'label' && styles.label,
        variant === 'muted' && [styles.muted, { color: theme.colors.inkMuted }],
        style,
      ]}
      {...props}>
      {children}
    </Text>
  );
}

export function IconButton({ icon, label, onPress, disabled = false }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useIgnisTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { borderColor: theme.colors.outline, opacity: disabled ? 0.4 : pressed ? 0.62 : 1 },
      ]}>
      <MaterialIcons color={theme.colors.ink} name={icon} size={24} />
    </Pressable>
  );
}

export function ActionButton({ label, onPress, icon, kind = 'filled', disabled = false, loading = false, style }: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  kind?: 'filled' | 'outlined' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useIgnisTheme();
  const filled = kind === 'filled' || kind === 'danger';
  const backgroundColor = kind === 'danger' ? theme.colors.danger : filled ? theme.colors.surfaceStrong : 'transparent';
  const color = filled ? theme.colors.background : theme.colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor, borderColor: filled ? backgroundColor : theme.colors.outlineStrong, opacity: disabled ? 0.38 : pressed ? 0.72 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={color} /> : (
        <>
          {icon ? <MaterialIcons color={color} name={icon} size={20} /> : null}
          <AppText variant="label" style={{ color }}>{label}</AppText>
        </>
      )}
    </Pressable>
  );
}

export function FormField({ label, error, containerStyle, style, ...props }: TextInputProps & { label: string; error?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const theme = useIgnisTheme();
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={theme.colors.inkMuted}
        selectionColor={theme.colors.accent}
        style={[styles.field, { backgroundColor: theme.colors.surface, borderColor: error ? theme.colors.danger : theme.colors.outline, color: theme.colors.ink }, style]}
        {...props}
      />
      {error ? <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{error}</AppText> : null}
    </View>
  );
}

export function Segment<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const theme = useIgnisTheme();
  return (
    <View style={[styles.segment, { borderColor: theme.colors.outline }]}> 
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segmentItem,
              { backgroundColor: selected ? theme.colors.surfaceStrong : pressed ? theme.colors.surface : 'transparent' },
            ]}>
            <AppText variant="label" style={{ color: selected ? theme.colors.background : theme.colors.ink, fontSize: 12 }}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Section({ title, children, trailing }: PropsWithChildren<{ title: string; trailing?: ReactNode }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="title">{title}</AppText>
        {trailing}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  text: { fontSize: 16, lineHeight: 23, fontFamily: 'sans-serif' },
  display: { fontFamily: displayFont, fontSize: 34, lineHeight: 40, fontVariant: ['tabular-nums'] },
  displayStrong: { fontFamily: displayFontStrong, fontSize: 38, lineHeight: 44, fontVariant: ['tabular-nums'] },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.35 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  muted: { fontSize: 14, lineHeight: 20 },
  iconButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  action: { minHeight: 52, borderWidth: 1.5, borderRadius: radii.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm },
  fieldWrap: { gap: spacing.sm },
  field: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 17 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radii.md, padding: 3 },
  segmentItem: { flex: 1, minHeight: 48, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  section: { gap: spacing.md, marginTop: spacing.xxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});
