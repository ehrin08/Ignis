import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, AppText } from '@/src/components/primitives';
import { localDateKey } from '@/src/domain/format';
import { parseLocalDate } from '@/src/domain/schedule';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';

type DutyDatePickerProps = {
  disabledDates: ReadonlySet<string>;
  onDismiss: () => void;
  onSelect: (date: string) => void;
  value: string;
  visible: boolean;
};

export function DutyDatePicker({ disabledDates, onDismiss, onSelect, value, visible }: DutyDatePickerProps) {
  const theme = useIgnisTheme();
  const [month, setMonth] = useState(() => startOfMonth(parseLocalDate(value)));

  useEffect(() => {
    if (visible) setMonth(startOfMonth(parseLocalDate(value)));
  }, [value, visible]);

  const cells = useMemo(() => calendarMonthCells(month), [month]);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <View style={[styles.backdrop, { backgroundColor: theme.dark ? '#000000B8' : '#00000066' }]}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.outline }]}>
          <View style={styles.header}>
            <MonthButton label="Previous month" name="chevron-left" onPress={() => setMonth(shiftMonth(month, -1))} />
            <AppText accessibilityRole="header" variant="title">{monthLabel}</AppText>
            <MonthButton label="Next month" name="chevron-right" onPress={() => setMonth(shiftMonth(month, 1))} />
          </View>
          <View style={styles.weekRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <AppText key={day} style={styles.weekday} variant="muted">{day.slice(0, 1)}</AppText>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const key = localDateKey(date);
              const disabled = disabledDates.has(key);
              const selected = key === value;
              const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
              return (
                <Pressable
                  accessibilityLabel={`${label}${disabled ? ', unavailable' : selected ? ', selected' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled, selected }}
                  disabled={disabled}
                  key={key}
                  onPress={() => onSelect(key)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    selected && { backgroundColor: theme.colors.surfaceStrong },
                    disabled && { backgroundColor: theme.colors.surface, opacity: 0.34 },
                    pressed && !disabled && { opacity: 0.62 },
                  ]}>
                  <AppText style={{ color: selected ? theme.colors.onSurfaceStrong : disabled ? theme.colors.inkMuted : theme.colors.ink }}>
                    {date.getDate()}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText variant="muted">Unavailable dates already have a duty.</AppText>
          <ActionButton kind="outlined" label="Close calendar" onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

function MonthButton({ label, name, onPress }: { label: string; name: 'chevron-left' | 'chevron-right'; onPress: () => void }) {
  const theme = useIgnisTheme();
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.monthButton, { borderColor: theme.colors.outline, opacity: pressed ? 0.62 : 1 }]}>
      <MaterialIcons color={theme.colors.ink} name={name} size={24} />
    </Pressable>
  );
}

export function calendarMonthCells(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(new Date(first.getFullYear(), first.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  dialog: { borderRadius: radii.lg, borderWidth: 1, gap: spacing.lg, padding: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthButton: { alignItems: 'center', borderRadius: radii.sm, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  weekRow: { flexDirection: 'row' },
  weekday: { textAlign: 'center', width: `${100 / 7}%` },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { alignItems: 'center', borderRadius: radii.sm, height: 44, justifyContent: 'center', width: `${100 / 7}%` },
});
