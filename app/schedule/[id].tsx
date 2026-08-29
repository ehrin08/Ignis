import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, AppText, FormField, Screen, Segment } from '@/src/components/primitives';
import { localDateKey } from '@/src/domain/format';
import { wallClockDate } from '@/src/domain/schedule';
import { validateScheduleInput } from '@/src/domain/validation';
import { useLiveNow } from '@/src/hooks/use-live-now';
import { useAppData } from '@/src/providers/app-provider';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';
import { AttendanceStatus, RecurrenceType, ScheduleEditScope, ScheduleInput } from '@/src/types';

const recurrenceOptions: { value: RecurrenceType; label: string }[] = [
  { value: 'once', label: 'One-off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekdays' },
];
const scopeOptions: { value: ScheduleEditScope; label: string }[] = [
  { value: 'occurrence', label: 'This duty' },
  { value: 'future', label: 'This + future' },
];
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ScheduleEntryScreen() {
  const theme = useIgnisTheme();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deleteSchedule, duties, saveSchedule, series, setAttendance } = useAppData();
  const now = useLiveNow(true, 60_000);
  const existing = duties.find((duty) => duty.id === id);
  const existingSeries = series.find((item) => item.id === existing?.seriesId);
  const isNew = id === 'new';
  const initialStart = useMemo(
    () => existing ? wallClockDate(existing.scheduledStart, existing.timezone) : nextRoundedHour(),
    [existing],
  );
  const initialEnd = useMemo(
    () => existing?.scheduledEnd ? wallClockDate(existing.scheduledEnd, existing.timezone) : new Date(initialStart.getTime() + 8 * 3_600_000),
    [existing, initialStart],
  );
  const [startDate, setStartDate] = useState(existing?.occurrenceDate ?? localDateKey(initialStart));
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [repeatEndDate, setRepeatEndDate] = useState(existingSeries?.endDate ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(existingSeries?.recurrence ?? 'once');
  const [weekdayMask, setWeekdayMask] = useState(existingSeries?.weekdayMask ?? [initialStart.getDay()]);
  const [breakMinutes, setBreakMinutes] = useState(String(Math.round((existing?.breakSeconds ?? 0) / 60)));
  const [note, setNote] = useState(existing?.note ?? '');
  const [scope, setScope] = useState<ScheduleEditScope>('occurrence');
  const [picker, setPicker] = useState<'date' | 'start' | 'end' | 'repeatEnd' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowExit = useRef(false);

  usePreventRemove(dirty, ({ data }) => {
    if (allowExit.current) return navigation.dispatch(data.action);
    Alert.alert('Discard unsaved changes?', 'Your schedule edits have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { allowExit.current = true; navigation.dispatch(data.action); } },
    ]);
  });

  if (!isNew && !existing) {
    return (
      <Screen contentStyle={styles.center}>
        <MaterialIcons color={theme.colors.inkMuted} name="event-busy" size={38} />
        <AppText variant="title">Duty not found</AppText>
        <AppText variant="muted">It may have been removed from the schedule.</AppText>
        <ActionButton kind="outlined" label="Return to schedule" onPress={() => router.back()} />
      </Screen>
    );
  }

  const input: ScheduleInput = {
    dutyId: existing?.id,
    seriesId: existing?.seriesId,
    scope,
    recurrence,
    startDate,
    endDate: recurrence === 'once' || !repeatEndDate.trim() ? null : repeatEndDate.trim(),
    weekdayMask,
    startMinutes: startTime.getHours() * 60 + startTime.getMinutes(),
    endMinutes: endTime.getHours() * 60 + endTime.getMinutes(),
    timezone: existing?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    breakSeconds: Math.round(Number(breakMinutes) * 60),
    note,
  };

  function choosePicker(event: DateTimePickerEvent, selected?: Date) {
    const active = picker;
    setPicker(null);
    if (event.type !== 'set' || !selected || !active) return;
    setDirty(true);
    if (active === 'date') setStartDate(localDateKey(selected));
    if (active === 'start') setStartTime(selected);
    if (active === 'end') setEndTime(selected);
    if (active === 'repeatEnd') setRepeatEndDate(localDateKey(selected));
  }

  async function persist() {
    const validationDuties = input.scope === 'future' && input.seriesId && existing
      ? duties.filter((duty) => !(duty.seriesId === input.seriesId && duty.occurrenceDate >= existing.occurrenceDate))
      : duties;
    const problem = validateScheduleInput(input, validationDuties);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await saveSchedule(input);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      allowExit.current = true;
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The schedule could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (existing?.status === 'completed' && dirty) {
      Alert.alert('Change completed duty?', 'This changes historical earned-pay estimates.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save change', onPress: persist },
      ]);
      return;
    }
    persist();
  }

  function changeAttendance(status: AttendanceStatus) {
    if (!existing || existing.status === status) return;
    Alert.alert('Correct attendance status?', `Change this duty from ${existing.status} to ${status}? Estimated gross pay will be recalculated.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change status', style: status === 'awol' ? 'destructive' : 'default', onPress: async () => {
        try {
          await setAttendance(existing.id, status);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Attendance could not be updated.');
        }
      } },
    ]);
  }

  function confirmDelete() {
    if (!existing) return;
    const remove = async (selectedScope: ScheduleEditScope) => {
      try {
        await deleteSchedule(existing.id, selectedScope);
        allowExit.current = true;
        router.back();
      } catch {
        setError('The duty could not be deleted. Try again.');
      }
    };
    if (existing.seriesId) {
      const seriesHistory = existing.status === 'pending' ? '' : ' This + future preserves duties whose attendance is already decided.';
      Alert.alert('Delete scheduled duty?', `Choose how much of the recurring schedule to remove.${seriesHistory}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'This duty', onPress: () => remove('occurrence') },
        { text: 'This + future', style: 'destructive', onPress: () => remove('future') },
      ]);
    } else {
      const historyWarning = existing.status === 'pending' ? '' : ' This removes decided attendance history and changes estimates.';
      Alert.alert('Delete this duty?', `This cannot be undone.${historyWarning}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove('occurrence') },
      ]);
    }
  }

  const ended = Boolean(existing?.scheduledEnd && existing.scheduledEnd <= now);

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.intro}>
        <AppText variant="title" style={styles.heading}>{isNew ? 'Add schedule' : 'Edit duty'}</AppText>
        <AppText variant="muted">Scheduled time is authoritative. An end time earlier than the start creates an overnight duty.</AppText>
      </View>

      {existingSeries ? (
        <View style={styles.fieldGroup}>
          <AppText variant="label">Apply changes to</AppText>
          <Segment onChange={(value) => { setScope(value); setDirty(true); }} options={scopeOptions} value={scope} />
        </View>
      ) : null}

      {(isNew || scope === 'future') ? (
        <View style={styles.fieldGroup}>
          <AppText variant="label">Repeat</AppText>
          <Segment onChange={(value) => { setRecurrence(value); setDirty(true); }} options={recurrenceOptions} value={recurrence} />
        </View>
      ) : null}

      {recurrence === 'weekly' && (isNew || scope === 'future') ? (
        <View style={styles.weekdays}>
          {weekdays.map((label, day) => {
            const selected = weekdayMask.includes(day);
            return (
              <Pressable
                accessibilityLabel={`${fullWeekday(day)} ${selected ? 'selected' : 'not selected'}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={`${label}-${day}`}
                onPress={() => { setWeekdayMask(selected ? weekdayMask.filter((item) => item !== day) : [...weekdayMask, day].sort()); setDirty(true); }}
                style={({ pressed }) => [styles.day, { backgroundColor: selected ? theme.colors.surfaceStrong : theme.colors.surface, borderColor: theme.colors.outline, opacity: pressed ? 0.62 : 1 }]}>
                <AppText variant="label" style={{ color: selected ? theme.colors.onSurfaceStrong : theme.colors.ink }}>{label}</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.pickerGrid}>
        <DateCell label="Start date" value={formatDate(startDate)} onPress={() => setPicker('date')} />
        <DateCell label="Start time" value={formatTime(startTime)} onPress={() => setPicker('start')} />
        <DateCell label="End time" value={formatTime(endTime)} onPress={() => setPicker('end')} />
      </View>

      {recurrence !== 'once' && (isNew || scope === 'future') ? (
        <View style={styles.repeatEndRow}>
          <DateCell
            label="Repeat until"
            value={repeatEndDate ? formatDate(repeatEndDate) : 'No end date'}
            onPress={() => setPicker('repeatEnd')}
          />
          {repeatEndDate ? <ActionButton kind="outlined" label="Clear end date" onPress={() => { setRepeatEndDate(''); setDirty(true); }} /> : null}
        </View>
      ) : null}
      <FormField keyboardType="number-pad" label="Unpaid break minutes" onChangeText={(value) => { setBreakMinutes(value); setDirty(true); }} value={breakMinutes} />
      <FormField label="Note (optional)" multiline onChangeText={(value) => { setNote(value); setDirty(true); }} placeholder="Training, location, duty type…" value={note} />

      {error ? <AppText style={{ color: theme.colors.danger }}>{error}</AppText> : null}
      <ActionButton label={isNew ? 'Add schedule' : 'Save changes'} loading={saving} onPress={save} />

      {existing && ended ? (
        <View style={styles.attendanceSection}>
          <AppText variant="title">Attendance</AppText>
          <AppText variant="muted">Current mark: {existing.status}. Corrections require confirmation.</AppText>
          <View style={styles.attendanceActions}>
            <ActionButton disabled={existing.status === 'completed'} kind="outlined" label="Completed" onPress={() => changeAttendance('completed')} style={styles.flex} />
            <ActionButton disabled={existing.status === 'awol'} kind="danger" label="AWOL" onPress={() => changeAttendance('awol')} style={styles.flex} />
          </View>
        </View>
      ) : null}

      {existing ? <ActionButton kind="danger" label="Delete duty" onPress={confirmDelete} /> : null}
      {picker ? <DateTimePicker
        mode={picker === 'date' || picker === 'repeatEnd' ? 'date' : 'time'}
        minimumDate={picker === 'repeatEnd' ? new Date(`${startDate}T12:00:00`) : undefined}
        onChange={choosePicker}
        value={picker === 'date' ? new Date(`${startDate}T12:00:00`) : picker === 'repeatEnd' ? new Date(`${repeatEndDate || startDate}T12:00:00`) : picker === 'start' ? startTime : endTime}
      /> : null}
    </Screen>
  );
}

function DateCell({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const theme = useIgnisTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dateCell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline, opacity: pressed ? 0.62 : 1 }]}>
      <AppText variant="label">{label}</AppText>
      <AppText>{value}</AppText>
    </Pressable>
  );
}

function nextRoundedHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
function formatTime(value: Date) { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(value); }
function fullWeekday(day: number) { return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]; }

const styles = StyleSheet.create({
  screen: { gap: spacing.xl, paddingTop: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xxl },
  intro: { gap: spacing.sm },
  heading: { fontSize: 30, lineHeight: 36 },
  fieldGroup: { gap: spacing.sm },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  repeatEndRow: { gap: spacing.sm },
  dateCell: { flexGrow: 1, minWidth: '30%', minHeight: 78, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, justifyContent: 'center', gap: spacing.xs },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  day: { width: 48, height: 48, borderWidth: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  attendanceSection: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: '#00000020' },
  attendanceActions: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
