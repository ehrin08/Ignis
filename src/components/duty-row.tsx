import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/primitives';
import { formatCurrency, formatHours } from '@/src/domain/format';
import { getDutyPaidSeconds } from '@/src/domain/pay';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';
import { AttendanceStatus, ScheduledDuty } from '@/src/types';

const statusCopy = {
  pending: { label: 'Pending', icon: 'schedule' as const },
  completed: { label: 'Completed', icon: 'check-circle' as const },
  awol: { label: 'AWOL', icon: 'error-outline' as const },
};

export function DutyRow({ duty, grossMinor, currencyCode, now, onPress, onStatus }: {
  duty: ScheduledDuty;
  grossMinor?: number;
  currencyCode: string;
  now: number;
  onPress: () => void;
  onStatus?: (status: AttendanceStatus) => void;
}) {
  const theme = useIgnisTheme();
  const status = statusCopy[duty.status];
  const statusColor = duty.status === 'completed' ? theme.colors.success : duty.status === 'awol' ? theme.colors.danger : theme.colors.inkMuted;
  const canReview = duty.status === 'pending' && duty.scheduledEnd !== null && duty.scheduledEnd <= now;
  const showAttendance = duty.status === 'pending' && duty.scheduledEnd !== null && Boolean(onStatus);
  const time = duty.scheduledEnd
    ? `${formatTime(duty.scheduledStart)}—${formatTime(duty.scheduledEnd)}`
    : `${formatTime(duty.scheduledStart)}—Needs end time`;

  return (
    <View style={[styles.shell, { borderColor: theme.colors.outline }]}>
      <Pressable
        accessibilityLabel={`Edit ${time} duty`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.62 : 1 }]}>
        <View style={[styles.marker, { borderColor: statusColor, backgroundColor: duty.status === 'completed' ? statusColor : 'transparent' }]} />
        <View style={styles.copy}>
          <AppText variant="label">{time}</AppText>
          <AppText variant="muted" numberOfLines={1}>
            {duty.note || `${formatHours(getDutyPaidSeconds(duty))} scheduled`}
          </AppText>
        </View>
        <View style={styles.trailing}>
          <View style={styles.status}>
            <MaterialIcons color={statusColor} name={status.icon} size={16} />
            <AppText variant="label" style={{ color: statusColor, fontSize: 11 }}>{status.label}</AppText>
          </View>
          {grossMinor !== undefined ? (
            <AppText adjustsFontSizeToFit numberOfLines={1} variant="display" style={styles.pay}>
              {formatCurrency(grossMinor, currencyCode)}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      {showAttendance && onStatus ? (
        <View style={[styles.review, { borderTopColor: theme.colors.outline }]}>
          <AttendanceButton disabled={!canReview} icon="check" label="Complete" color={theme.colors.success} onPress={() => onStatus('completed')} />
          <AttendanceButton disabled={!canReview} icon="person-off" label="Mark AWOL" color={theme.colors.danger} onPress={() => onStatus('awol')} />
        </View>
      ) : null}
    </View>
  );
}

function AttendanceButton({ icon, label, color, disabled, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; color: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.attendance, { borderColor: color, opacity: disabled ? 0.36 : pressed ? 0.62 : 1 }]}>
      <MaterialIcons color={color} name={icon} size={19} />
      <AppText variant="label" style={{ color, fontSize: 11 }}>{label}</AppText>
    </Pressable>
  );
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  main: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  marker: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  trailing: { maxWidth: '42%', alignItems: 'flex-end', gap: 3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pay: { fontSize: 19, maxWidth: 138 },
  review: { borderTopWidth: 1, borderStyle: 'dashed', padding: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  attendance: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
