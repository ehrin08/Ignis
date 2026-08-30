import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, AppText, FormField, Screen, Segment } from '@/src/components/primitives';
import { DutyDatePicker } from '@/src/components/duty-date-picker';
import { takenDutyDates } from '@/src/domain/duty-dates';
import { localDateKey } from '@/src/domain/format';
import { wallClockDate } from '@/src/domain/schedule';
import { validateScheduleInput } from '@/src/domain/validation';
import { useLiveNow } from '@/src/hooks/use-live-now';
import { useAppData } from '@/src/providers/app-provider';
import { useConfirm, useDialog, useToast } from '@/src/providers/feedback-provider';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';
import { AttendanceStatus, RateOverride, RecurrenceType, ScheduleEditScope, ScheduleInput } from '@/src/types';

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
const standardBreakMinutes = [30, 60, 120] as const;
const rateOverrideOptions: { value: RateOverride['type']; label: string }[] = [
  { value: 'hourly', label: 'Hourly rate' },
  { value: 'day', label: 'Day rate' },
];

export default function ScheduleEntryScreen() {
  const theme = useIgnisTheme();
  const navigation = useNavigation();
  const confirm = useConfirm();
  const { showChoice } = useDialog();
  const toast = useToast();
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
    () => existing?.scheduledEnd
      ? wallClockDate(existing.scheduledEnd, existing.timezone)
      : new Date(initialStart.getTime() + 8 * 60 * 60 * 1000),
    [existing, initialStart],
  );
  const [startDate, setStartDate] = useState(existing?.occurrenceDate ?? localDateKey(initialStart));
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [repeatEndDate, setRepeatEndDate] = useState(existingSeries?.endDate ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(existingSeries?.recurrence ?? 'once');
  const [weekdayMask, setWeekdayMask] = useState(existingSeries?.weekdayMask ?? [initialStart.getDay()]);
  const [breakMinutes, setBreakMinutes] = useState(existing ? Math.round(existing.breakSeconds / 60) : 30);
  const initialRateOverride = existing?.rateOverride ?? existingSeries?.rateOverride;
  const [rateOverrideType, setRateOverrideType] = useState<RateOverride['type']>(initialRateOverride?.type ?? 'hourly');
  const [rateOverrideAmount, setRateOverrideAmount] = useState(() =>
    initialRateOverride === null || initialRateOverride === undefined ? '' : (initialRateOverride.amountMinor / 100).toString(),
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [scope, setScope] = useState<ScheduleEditScope>('occurrence');
  const [picker, setPicker] = useState<'start' | 'end' | 'repeatEnd' | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowExit = useRef(false);

  usePreventRemove(dirty, async ({ data }) => {
    if (allowExit.current) return navigation.dispatch(data.action);
    const confirmed = await confirm({
      title: 'Discard unsaved changes?',
      message: 'Your schedule edits have not been saved.',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      destructive: true,
    });
    if (confirmed) {
      allowExit.current = true;
      navigation.dispatch(data.action);
    }
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
    breakSeconds: breakMinutes * 60,
    rateOverride: rateOverrideAmount.trim() === '' ? null : {
      type: rateOverrideType,
      amountMinor: Math.round(Number(rateOverrideAmount.replace(',', '.')) * 100),
    },
    note,
  };

  function choosePicker(event: DateTimePickerEvent, selected?: Date) {
    const active = picker;
    setPicker(null);
    if (event.type !== 'set' || !selected || !active) return;
    setDirty(true);
    if (active === 'start') setStartTime(selected);
    if (active === 'end') setEndTime(selected);
    if (active === 'repeatEnd') setRepeatEndDate(localDateKey(selected));
  }

  async function persist() {
    const problem = validateScheduleInput(input, duties);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await saveSchedule(input);
      allowExit.current = true;
      toast.success(isNew ? 'Schedule entry created.' : 'Duty updated.', 'Schedule Saved');
      router.back();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'The schedule could not be saved.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (existing?.status === 'completed' && dirty) {
      const confirmed = await confirm({
        title: 'Change completed duty?',
        message: 'This changes historical earned-pay estimates.',
        confirmText: 'Save change',
        cancelText: 'Cancel',
      });
      if (!confirmed) return;
    }
    persist();
  }

  async function changeAttendance(status: AttendanceStatus) {
    if (!existing || existing.status === status) return;
    const isAwol = status === 'awol';
    const confirmed = await confirm({
      title: 'Correct attendance status?',
      message: `Change this duty from ${existing.status} to ${status}? Estimated gross pay will be recalculated.`,
      confirmText: 'Change status',
      destructive: isAwol,
    });
    if (!confirmed) return;

    try {
      await setAttendance(existing.id, status);
      toast.success(`Duty status changed to ${status}.`, 'Attendance Updated');
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Attendance could not be updated.';
      setError(msg);
      toast.error(msg);
    }
  }

  async function confirmDelete() {
    if (!existing) return;
    const remove = async (selectedScope: ScheduleEditScope) => {
      try {
        await deleteSchedule(existing.id, selectedScope);
        allowExit.current = true;
        toast.success(
          selectedScope === 'future' ? 'Recurring schedule removed.' : 'Scheduled duty deleted.',
          'Schedule Updated'
        );
        router.back();
      } catch {
        const msg = 'The duty could not be deleted. Try again.';
        setError(msg);
        toast.error(msg);
      }
    };

    if (existing.seriesId) {
      const seriesHistory = existing.status === 'pending' ? '' : ' This + future preserves duties whose attendance is already decided.';
      const choice = await showChoice<ScheduleEditScope | 'cancel'>({
        title: 'Delete scheduled duty?',
        message: `Choose how much of the recurring schedule to remove.${seriesHistory}`,
        buttons: [
          { text: 'This duty only', value: 'occurrence', kind: 'outlined' },
          { text: 'This + future duties', value: 'future', kind: 'danger' },
          { text: 'Cancel', value: 'cancel', style: 'cancel' },
        ],
        dismissValue: 'cancel',
      });

      if (choice && choice !== 'cancel') {
        await remove(choice);
      }
    } else {
      const historyWarning = existing.status === 'pending' ? '' : ' This removes decided attendance history and changes estimates.';
      const confirmed = await confirm({
        title: 'Delete this duty?',
        message: `This cannot be undone.${historyWarning}`,
        confirmText: 'Delete',
        destructive: true,
      });

      if (confirmed) {
        await remove('occurrence');
      }
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
        <DateCell label="Start date" value={formatDate(startDate)} onPress={() => setDatePickerOpen(true)} />
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
      <View style={styles.fieldGroup}>
        <AppText variant="label">Unpaid break</AppText>
        <Segment
          onChange={(value) => { if (value !== 'custom') setBreakMinutes(Number(value)); setDirty(true); }}
          options={breakOptions(breakMinutes)}
          value={standardBreakMinutes.includes(breakMinutes as 30 | 60 | 120) ? String(breakMinutes) as '30' | '60' | '120' : 'custom'}
        />
        {standardBreakMinutes.includes(breakMinutes as 30 | 60 | 120) ? null : <AppText variant="muted">Existing break: {breakMinutes} minutes. Choose a preset to replace it.</AppText>}
      </View>
      <View style={styles.fieldGroup}>
        <AppText variant="label">Rate override (optional)</AppText>
        <Segment
          onChange={(value) => { setRateOverrideType(value); setDirty(true); }}
          options={rateOverrideOptions}
          value={rateOverrideType}
        />
        <FormField
          keyboardType="decimal-pad"
          label={rateOverrideType === 'day' ? 'Day rate' : 'Hourly rate'}
          onChangeText={(value) => { setRateOverrideAmount(value); setDirty(true); }}
          placeholder={rateOverrideType === 'day' ? 'Enter flat rate per duty' : 'Use default hourly rate'}
          value={rateOverrideAmount}
        />
      </View>
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
      <DutyDatePicker
        disabledDates={takenDutyDates(input, duties)}
        onDismiss={() => setDatePickerOpen(false)}
        onSelect={(date) => { setStartDate(date); setDatePickerOpen(false); setDirty(true); setError(null); }}
        value={startDate}
        visible={datePickerOpen}
      />
      {picker ? <DateTimePicker
        mode={picker === 'repeatEnd' ? 'date' : 'time'}
        minimumDate={picker === 'repeatEnd' ? new Date(`${startDate}T12:00:00`) : undefined}
        onChange={choosePicker}
        value={picker === 'repeatEnd' ? new Date(`${repeatEndDate || startDate}T12:00:00`) : picker === 'start' ? startTime : endTime}
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
function breakOptions(minutes: number): { value: '30' | '60' | '120' | 'custom'; label: string }[] {
  const options: { value: '30' | '60' | '120' | 'custom'; label: string }[] = [
    { value: '30', label: '30 min' }, { value: '60', label: '1 hr' }, { value: '120', label: '2 hrs' },
  ];
  return standardBreakMinutes.includes(minutes as 30 | 60 | 120) ? options : [...options, { value: 'custom', label: `${minutes} min` }];
}

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
