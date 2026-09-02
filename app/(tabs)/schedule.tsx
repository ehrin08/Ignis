import { MaterialIcons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DutyRow } from '@/src/components/duty-row';
import { AppText, IconButton, Screen } from '@/src/components/primitives';
import { formatCurrency, formatHours, formatPeriodRange } from '@/src/domain/format';
import { allocateDutyGross, calculatePay } from '@/src/domain/pay';
import { getPayPeriod, isInPeriod } from '@/src/domain/periods';
import { useLiveNow } from '@/src/hooks/use-live-now';
import { useAppData } from '@/src/providers/app-provider';
import { useToast } from '@/src/providers/feedback-provider';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';

export default function ScheduleScreen() {
  const theme = useIgnisTheme();
  const { duties, ensureWindow, error, refresh, settings, syncAndRefresh } = useAppData();
  const toast = useToast();
  const now = useLiveNow(true, 60_000);
  const [offset, setOffset] = useState(0);
  const period = useMemo(() => getPayPeriod(new Date(now), settings, offset), [now, offset, settings]);

  useEffect(() => {
    ensureWindow(period.start, period.end).catch(() => undefined);
  }, [ensureWindow, period.end, period.start]);

  const handleRefresh = useCallback(async () => {
    try {
      await syncAndRefresh();
      await ensureWindow(period.start, period.end);
    } catch {
      toast.error('Cloud sync could not complete. Local schedule is up to date.', 'Sync Incomplete');
    }
  }, [ensureWindow, period.end, period.start, syncAndRefresh, toast]);

  const periodDuties = duties.filter((duty) => isInPeriod(duty.scheduledStart, period));
  const completed = periodDuties.filter((duty) => duty.status === 'completed');
  const total = calculatePay(completed, settings);
  const allocation = allocateDutyGross(completed, settings);
  const groups = periodDuties.reduce<Record<string, typeof duties>>((result, duty) => {
    (result[duty.occurrenceDate] ??= []).push(duty);
    return result;
  }, {});

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Screen scroll onRefresh={handleRefresh} contentStyle={styles.screen}>
        <View style={styles.topBar}>
          <View>
            <AppText variant="title" style={styles.heading}>Schedule</AppText>
            <AppText variant="muted">{formatPeriodRange(period.start, period.end)}</AppText>
          </View>
          <View style={styles.navButtons}>
            <IconButton icon="chevron-left" label="Previous pay period" onPress={() => setOffset((value) => value - 1)} />
            <IconButton icon="chevron-right" label="Next pay period" onPress={() => setOffset((value) => value + 1)} />
          </View>
        </View>

        {error ? (
          <View style={[styles.error, { borderColor: theme.colors.danger }]}>
            <MaterialIcons color={theme.colors.danger} name="error-outline" size={20} />
            <AppText style={{ color: theme.colors.danger, flex: 1 }}>{error}</AppText>
            <IconButton icon="refresh" label="Retry schedule refresh" onPress={refresh} />
          </View>
        ) : null}

        <View style={[styles.total, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
          <View style={styles.totalTop}>
            <AppText variant="label">Completed gross estimate</AppText>
            <AppText variant="label">{completed.length}/{periodDuties.length} complete</AppText>
          </View>
          <AppText adjustsFontSizeToFit numberOfLines={1} variant="displayStrong" style={styles.totalAmount}>
            {formatCurrency(total.grossMinor, settings.currencyCode)}
          </AppText>
          <AppText variant="muted">
            {formatHours(total.paidSeconds)} paid · {formatHours(total.overtimeSeconds)} overtime
          </AppText>
        </View>

        {Object.keys(groups).length ? Object.entries(groups).map(([day, entries]) => (
          <View key={day} style={styles.group}>
            <View style={styles.dayRail}>
              <View style={[styles.dayMarker, { borderColor: day === localToday(now) ? theme.colors.accent : theme.colors.outlineStrong }]} />
              <View style={[styles.rail, { backgroundColor: theme.colors.outline }]} />
            </View>
            <View style={styles.dayBody}>
              <View style={styles.dayHeader}>
                <AppText variant="title">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00`))}</AppText>
                <AppText variant="muted">{entries.length} {entries.length === 1 ? 'duty' : 'duties'}</AppText>
              </View>
              {entries.map((duty) => (
                <DutyRow
                  currencyCode={settings.currencyCode}
                  duty={duty}
                  grossMinor={duty.status === 'awol' ? 0 : duty.status === 'completed' ? allocation.get(duty.id) : undefined}
                  key={duty.id}
                  now={now}
                  onPress={() => router.push(`/schedule/${duty.id}` as Href)}
                />
              ))}
            </View>
          </View>
        )) : (
          <View style={[styles.empty, { borderColor: theme.colors.outline }]}>
            <MaterialIcons color={theme.colors.inkMuted} name="event-note" size={34} />
            <AppText variant="title">No duties in this period</AppText>
            <AppText variant="muted" style={{ textAlign: 'center' }}>Add a one-off, daily, or weekday schedule with the red button.</AppText>
          </View>
        )}
      </Screen>
      <Pressable
        accessibilityLabel="Add a schedule"
        accessibilityRole="button"
        onPress={() => router.push('/schedule/new' as Href)}
        style={({ pressed }) => [styles.fab, { backgroundColor: theme.colors.accent, opacity: pressed ? 0.72 : 1 }]}>
        <MaterialIcons color={theme.colors.onAccent} name="add" size={28} />
      </Pressable>
    </View>
  );
}

function localToday(now: number) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { gap: spacing.xl, paddingTop: spacing.md },
  topBar: { minHeight: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 30, lineHeight: 36 },
  navButtons: { flexDirection: 'row', gap: spacing.sm },
  error: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, paddingLeft: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  total: { borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, gap: spacing.xs },
  totalTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  totalAmount: { fontSize: 30, lineHeight: 38 },
  group: { flexDirection: 'row', gap: spacing.md },
  dayRail: { width: 18, alignItems: 'center' },
  dayMarker: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: 'transparent' },
  rail: { width: 1, flex: 1, marginTop: spacing.xs },
  dayBody: { flex: 1, gap: spacing.md, paddingBottom: spacing.md },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.md, padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 5 },
});
