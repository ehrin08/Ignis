import { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText, FormField, Section, Segment } from '@/src/components/primitives';
import { spacing } from '@/src/theme/tokens';
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
          <View style={styles.twoColumns}>
            <NumericSetting
              label={`${value.overtimeMode === 'daily' ? 'Daily' : 'Weekly'} threshold`}
              onCommit={(number) => onChange({ ...value, overtimeThresholdMinutes: Math.round(number * 60) })}
              style={styles.flex}
              value={value.overtimeThresholdMinutes / 60}
            />
            <NumericSetting
              label="Multiplier"
              onCommit={(number) => onChange({ ...value, overtimeMultiplierBps: Math.round(number * 10_000) })}
              style={styles.flex}
              value={value.overtimeMultiplierBps / 10_000}
            />
          </View>
        ) : null}
      </Section>
    </>
  );
}

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
  if (value.overtimeMode !== 'none' && value.overtimeMultiplierBps < 10_000) return 'Overtime multiplier must be at least 1.0.';
  return null;
}

const styles = StyleSheet.create({
  twoColumns: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
