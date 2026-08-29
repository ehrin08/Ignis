import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText, FormField, Section, Segment } from '@/src/components/primitives';
import { spacing, useIgnisTheme } from '@/src/theme/tokens';
import { AppSettings, OvertimeMode, PayCycleType } from '@/src/types';

const payCycles: { value: PayCycleType; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: '2 weeks' },
  { value: 'semimonthly', label: 'Twice/mo' },
  { value: 'monthly', label: 'Monthly' },
];

const overtimeModes: { value: OvertimeMode; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export function SettingsEditor({ value, onChange }: { value: AppSettings; onChange: (value: AppSettings) => void }) {
  const [nightPicker, setNightPicker] = useState<'start' | 'end' | null>(null);
  const changeNightTime = (event: DateTimePickerEvent, selected?: Date) => {
    const active = nightPicker;
    setNightPicker(null);
    if (event.type !== 'set' || !selected || !active) return;
    const minutes = selected.getHours() * 60 + selected.getMinutes();
    onChange({
      ...value,
      [active === 'start' ? 'nightDifferentialStartMinutes' : 'nightDifferentialEndMinutes']: minutes,
    });
  };
  return (
    <>
      <Section title="Pay profile">
        <View style={styles.twoColumns}>
          <FormField
            autoCapitalize="characters"
            label="Currency"
            maxLength={3}
            onChangeText={(currencyCode) => onChange({ ...value, currencyCode: currencyCode.toUpperCase() })}
            containerStyle={styles.flex}
            value={value.currencyCode}
          />
          <NumericSetting
            label="Hourly rate"
            onCommit={(number) => onChange({ ...value, hourlyRateMinor: Math.round(number * 100) })}
            style={styles.flex}
            value={value.hourlyRateMinor / 100}
          />
        </View>
        <AppText variant="label">Pay cycle</AppText>
        <Segment onChange={(payCycleType) => onChange({ ...value, payCycleType })} options={payCycles} value={value.payCycleType} />
        {value.payCycleType !== 'semimonthly' ? (
          <FormField
            autoCapitalize="none"
            label={value.payCycleType === 'monthly' ? 'Monthly anchor date' : 'Cycle anchor date'}
            onChangeText={(payCycleAnchor) => onChange({ ...value, payCycleAnchor })}
            placeholder="YYYY-MM-DD"
            value={value.payCycleAnchor}
          />
        ) : null}
      </Section>

      <Section title="Overtime">
        <Segment onChange={(overtimeMode) => onChange({ ...value, overtimeMode })} options={overtimeModes} value={value.overtimeMode} />
        {value.overtimeMode !== 'none' ? (
          <>
            <NumericSetting
              label={`${value.overtimeMode === 'daily' ? 'Daily' : 'Weekly'} threshold`}
              onCommit={(number) => onChange({ ...value, overtimeThresholdMinutes: Math.round(number * 60) })}
              value={value.overtimeThresholdMinutes / 60}
            />
            <PercentageSlider
              label="Overtime premium"
              onChange={(percentage) => onChange({ ...value, overtimeMultiplierBps: 10_000 + percentage * 100 })}
              value={Math.round((value.overtimeMultiplierBps - 10_000) / 100)}
            />
          </>
        ) : null}
      </Section>

      <Section title="Night differential">
        <PercentageSlider
          label="Night premium"
          onChange={(percentage) => onChange({ ...value, nightDifferentialBps: percentage * 100 })}
          value={Math.round(value.nightDifferentialBps / 100)}
        />
        <View style={styles.twoColumns}>
          <TimeSetting label="Starts" minutes={value.nightDifferentialStartMinutes} onPress={() => setNightPicker('start')} />
          <TimeSetting label="Ends" minutes={value.nightDifferentialEndMinutes} onPress={() => setNightPicker('end')} />
        </View>
        {nightPicker ? <DateTimePicker mode="time" onChange={changeNightTime} value={timeAtMinutes(nightPicker === 'start' ? value.nightDifferentialStartMinutes : value.nightDifferentialEndMinutes)} /> : null}
      </Section>
    </>
  );
}

function PercentageSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const theme = useIgnisTheme();
  const [width, setWidth] = useState(1);
  const setFromPosition = (position: number) => onChange(Math.max(0, Math.min(100, Math.round((position / width) * 20) * 5)));
  return (
    <View style={styles.sliderWrap}>
      <AppText variant="label">{label} · {value}%</AppText>
      <Pressable
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityRole="adjustable"
        accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}%` }}
        onAccessibilityAction={(event) => onChange(Math.max(0, Math.min(100, value + (event.nativeEvent.actionName === 'increment' ? 5 : -5))))}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onPress={(event) => setFromPosition(event.nativeEvent.locationX)}
        style={[styles.sliderRail, { backgroundColor: theme.colors.outline }]}
      >
        <View pointerEvents="none" style={[styles.sliderFill, { backgroundColor: theme.colors.surfaceStrong, width: `${value}%` }]} />
        <View pointerEvents="none" style={[styles.sliderThumb, { backgroundColor: theme.colors.accent, left: `${value}%` }]} />
      </Pressable>
    </View>
  );
}

function TimeSetting({ label, minutes, onPress }: { label: string; minutes: number; onPress: () => void }) {
  const theme = useIgnisTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.timeSetting, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}><AppText variant="label">{label}</AppText><AppText>{formatTime(minutes)}</AppText></Pressable>;
}

function timeAtMinutes(minutes: number) { const value = new Date(); value.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return value; }
function formatTime(minutes: number) { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timeAtMinutes(minutes)); }

function NumericSetting({ label, value, onCommit, style }: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [raw, setRaw] = useState(value.toString());
  useEffect(() => setRaw(value.toString()), [value]);
  return (
    <FormField
      keyboardType="decimal-pad"
      label={label}
      onBlur={() => {
        const number = Number(raw.replace(',', '.'));
        if (Number.isFinite(number)) onCommit(Math.max(0, number));
      }}
      onChangeText={setRaw}
      containerStyle={style}
      value={raw}
    />
  );
}

export function validateSettings(value: AppSettings) {
  if (!/^[A-Z]{3}$/.test(value.currencyCode)) return 'Enter a three-letter currency code such as PHP or USD.';
  if (value.hourlyRateMinor <= 0) return 'Enter an hourly rate greater than zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.payCycleAnchor)) return 'Enter the anchor date as YYYY-MM-DD.';
  const [year, month, day] = value.payCycleAnchor.split('-').map(Number);
  const anchor = new Date(year, month - 1, day);
  if (anchor.getFullYear() !== year || anchor.getMonth() !== month - 1 || anchor.getDate() !== day) return 'Enter a valid cycle anchor date.';
  if (value.overtimeMode !== 'none' && value.overtimeThresholdMinutes <= 0) return 'Overtime threshold must be greater than zero.';
  if (value.overtimeMultiplierBps < 10_000 || value.overtimeMultiplierBps > 20_000 || value.overtimeMultiplierBps % 500 !== 0) return 'Overtime premium must be between 0% and 100% in 5% steps.';
  if (value.nightDifferentialBps < 0 || value.nightDifferentialBps > 10_000 || value.nightDifferentialBps % 500 !== 0) return 'Night premium must be between 0% and 100% in 5% steps.';
  if (![value.nightDifferentialStartMinutes, value.nightDifferentialEndMinutes].every((minutes) => Number.isInteger(minutes) && minutes >= 0 && minutes < 1440)) return 'Choose valid night differential times.';
  return null;
}

const styles = StyleSheet.create({
  twoColumns: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  sliderWrap: { gap: spacing.sm },
  sliderRail: { height: 10, borderRadius: 5, justifyContent: 'center' },
  sliderFill: { height: 10, borderRadius: 5 },
  sliderThumb: { position: 'absolute', width: 24, height: 24, marginLeft: -12, borderRadius: 12 },
  timeSetting: { flex: 1, minHeight: 76, borderWidth: 1, borderRadius: 12, padding: spacing.md, justifyContent: 'center', gap: spacing.xs },
});
