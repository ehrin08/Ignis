/*
THESIS: The schedule is an exposed attendance ledger; refuse the generic calendar-card dashboard.
OWN-WORLD: Warm paper, graphite agenda instrument, signal-red review state, perforated rules, dotted money.
STORY: Read earned/projected pay, resolve overdue attendance, then scan today's and next duties.
FIRST VIEWPORT: Paired totals, one strong next-duty instrument, and the first review/today row.
FORM: Clockwork Ledger / Schedule Rail, evolved from approved candidate 4 and seed 1a99c130.
*/
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Href, router } from 'expo-router';
import { ReactNode, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { DutyRow } from '@/src/components/duty-row';
import { AppText, IconButton, Screen } from '@/src/components/primitives';
import { formatCurrency, formatPeriodRange, localDateKey } from '@/src/domain/format';
import { allocateDutyGross, calculateDashboardSummary } from '@/src/domain/pay';
import { getPayPeriod, isInPeriod } from '@/src/domain/periods';
import { useLiveNow } from '@/src/hooks/use-live-now';
import { useAppData } from '@/src/providers/app-provider';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';
import { AttendanceStatus, ScheduledDuty } from '@/src/types';

export default function TodayScreen() {
  const theme = useIgnisTheme();
  const { duties, error, refresh, setAttendance, settings } = useAppData();
  const now = useLiveNow(true, 60_000);
  const date = useMemo(() => new Date(now), [now]);
  const todayKey = localDateKey(date);
  const { allocation, period, summary } = useMemo(() => {
    const currentPeriod = getPayPeriod(date, settings);
    const periodDuties = duties.filter((duty) => isInPeriod(duty.scheduledStart, currentPeriod));
    const payable = periodDuties.filter((duty) =>
      duty.status === 'completed' || (duty.status === 'pending' && duty.scheduledEnd !== null && duty.scheduledEnd > now),
    );
    return {
      period: currentPeriod,
      summary: calculateDashboardSummary(duties, settings, currentPeriod, date),
      allocation: allocateDutyGross(payable, settings),
    };
  }, [date, duties, now, settings]);

  const overdue = duties.filter((duty) => duty.status === 'pending' && (duty.scheduledEnd === null || duty.scheduledEnd <= now));
  const today = duties.filter((duty) => duty.occurrenceDate === todayKey && !overdue.some((item) => item.id === duty.id));
  const next = duties.find((duty) => duty.status === 'pending' && duty.scheduledStart > now && duty.scheduledEnd !== null) ?? null;

  function confirmAttendance(duty: ScheduledDuty, status: AttendanceStatus) {
    Alert.alert(
      status === 'completed' ? 'Mark duty completed?' : 'Mark duty AWOL?',
      status === 'completed'
        ? 'Its scheduled paid time will move into earned gross pay.'
        : 'This duty will contribute zero earned pay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'completed' ? 'Complete' : 'Mark AWOL',
          style: status === 'awol' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await setAttendance(duty.id, status);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              // Provider exposes the actionable database error in the banner.
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <View>
          <AppText variant="displayStrong" style={styles.brand}>IGNIS</AppText>
          <AppText variant="muted">{formatPeriodRange(period.start, period.end)}</AppText>
        </View>
      </View>

      {error ? (
        <View style={[styles.error, { borderColor: theme.colors.danger }]}>
          <MaterialIcons color={theme.colors.danger} name="error-outline" size={20} />
          <AppText style={{ color: theme.colors.danger, flex: 1 }}>{error}</AppText>
          <IconButton icon="refresh" label="Retry schedule refresh" onPress={refresh} />
        </View>
      ) : null}

      <View style={styles.moneyRow}>
        <View style={styles.moneyColumn}>
          <AppText variant="label">Earned</AppText>
          <AppText adjustsFontSizeToFit numberOfLines={1} variant="displayStrong" style={styles.money}>
            {formatCurrency(summary.earned.grossMinor, settings.currencyCode)}
          </AppText>
        </View>
        <View style={[styles.moneyRule, { backgroundColor: theme.colors.outline }]} />
        <View style={styles.moneyColumn}>
          <AppText variant="label">Projected</AppText>
          <AppText adjustsFontSizeToFit numberOfLines={1} variant="displayStrong" style={styles.money}>
            {formatCurrency(summary.projected.grossMinor, settings.currencyCode)}
          </AppText>
        </View>
      </View>

      <NextDutyInstrument duty={next} />

      {overdue.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <AppText variant="title">Needs review</AppText>
              <AppText variant="muted">{overdue.length} {overdue.length === 1 ? 'duty is' : 'duties are'} waiting for attendance.</AppText>
            </View>
            <View style={[styles.count, { backgroundColor: theme.colors.accent }]}><AppText variant="label" style={{ color: theme.colors.onAccent }}>{overdue.length}</AppText></View>
          </View>
          {overdue.map((duty, index) => (
            <RailDuty key={duty.id} last={index === overdue.length - 1} urgent>
            <DutyRow
              currencyCode={settings.currencyCode}
              duty={duty}
              now={now}
              onPress={() => router.push(`/schedule/${duty.id}` as Href)}
              onStatus={(status) => confirmAttendance(duty, status)}
            />
            </RailDuty>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <View>
          <AppText variant="title">Today</AppText>
          <AppText variant="muted">Scheduled duties that still lie ahead or are already decided.</AppText>
        </View>
        {today.length ? today.map((duty, index) => (
          <RailDuty key={duty.id} last={index === today.length - 1}>
          <DutyRow
            currencyCode={settings.currencyCode}
            duty={duty}
            grossMinor={duty.status === 'awol' ? 0 : allocation.get(duty.id)}
            now={now}
            onPress={() => router.push(`/schedule/${duty.id}` as Href)}
            onStatus={(status) => confirmAttendance(duty, status)}
          />
          </RailDuty>
        )) : (
          <View style={[styles.empty, { borderColor: theme.colors.outline }]}>
            <MaterialIcons color={theme.colors.inkMuted} name="event-available" size={30} />
            <View style={{ flex: 1 }}>
              <AppText variant="title">No more duties today</AppText>
              <AppText variant="muted">Add a one-off or recurring schedule when your rota is ready.</AppText>
            </View>
          </View>
        )}
      </View>

      <AppText variant="muted" style={styles.disclaimer}>Estimated gross pay before taxes, benefits, bonuses, premiums, or deductions.</AppText>
    </Screen>
    <Pressable
      accessibilityLabel="Add a schedule"
      accessibilityRole="button"
      onPress={() => router.push('/schedule/new' as Href)}
      style={({ pressed }) => [styles.fab, { backgroundColor: theme.colors.accent, opacity: pressed ? 0.72 : 1 }]}
    >
      <MaterialIcons color={theme.colors.onAccent} name="add" size={28} />
    </Pressable>
    </View>
  );
}

function RailDuty({ children, last, urgent = false }: { children: ReactNode; last: boolean; urgent?: boolean }) {
  const theme = useIgnisTheme();
  return (
    <View style={styles.railDuty}>
      <View style={styles.dutyRail}>
        <View style={[styles.dutyMarker, { borderColor: urgent ? theme.colors.accent : theme.colors.outlineStrong }]} />
        {!last ? <View style={[styles.dutyLine, { backgroundColor: theme.colors.outline }]} /> : null}
      </View>
      <View style={styles.dutyBody}>{children}</View>
    </View>
  );
}

function NextDutyInstrument({ duty }: { duty: ScheduledDuty | null }) {
  const theme = useIgnisTheme();
  return (
    <View style={[styles.instrument, { backgroundColor: theme.colors.surfaceStrong }]}>
      <View style={styles.instrumentTop}>
        <AppText variant="label" style={{ color: theme.colors.onSurfaceStrongMuted }}>Next duty</AppText>
        <View style={styles.perforations}>
          {Array.from({ length: 13 }, (_, index) => <View key={index} style={[styles.hole, { backgroundColor: theme.colors.onSurfaceStrongMuted }]} />)}
        </View>
      </View>
      {duty ? (
        <>
          <AppText variant="displayStrong" style={[styles.nextTime, { color: theme.colors.onSurfaceStrong }]}>
            {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(duty.scheduledStart)}
          </AppText>
          <AppText style={{ color: theme.colors.onSurfaceStrong }}>
            {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(duty.scheduledStart)}
            {duty.scheduledEnd ? ` · until ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(duty.scheduledEnd)}` : ''}
          </AppText>
          <AppText variant="muted" style={{ color: theme.colors.onSurfaceStrongMuted }}>{duty.note || 'Scheduled duty'}</AppText>
        </>
      ) : (
        <View style={styles.instrumentEmpty}>
          <MaterialIcons color={theme.colors.onSurfaceStrongMuted} name="event" size={30} />
          <AppText variant="title" style={{ color: theme.colors.onSurfaceStrong }}>Schedule clear</AppText>
          <AppText variant="muted" style={{ color: theme.colors.onSurfaceStrongMuted }}>No future duty has been entered.</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { gap: spacing.xl, paddingTop: spacing.md },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: 34, lineHeight: 38 },
  error: { minHeight: 52, borderWidth: 1, borderRadius: radii.md, paddingLeft: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  moneyRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  moneyColumn: { flex: 1, gap: spacing.xs, minWidth: 0 },
  moneyRule: { width: 1 },
  money: { fontSize: 27, lineHeight: 34 },
  instrument: { minHeight: 196, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, elevation: 3 },
  instrumentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  perforations: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  hole: { width: 5, height: 5, borderRadius: 3, opacity: 0.7 },
  nextTime: { fontSize: 48, lineHeight: 56, marginTop: spacing.sm },
  instrumentEmpty: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  section: { gap: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  railDuty: { flexDirection: 'row', gap: spacing.sm },
  dutyRail: { width: 16, alignItems: 'center' },
  dutyMarker: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, marginTop: spacing.lg },
  dutyLine: { width: 1, flex: 1, minHeight: spacing.lg },
  dutyBody: { flex: 1 },
  count: { minWidth: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 88, borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  disclaimer: { textAlign: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 5 },
});
