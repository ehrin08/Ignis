import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { PropsWithChildren, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, AppText, Screen } from '@/src/components/primitives';
import { useBudget } from '@/src/providers/budget-provider';
import { useConfirm } from '@/src/providers/feedback-provider';
import { radii, spacing, useIgnisTheme } from '@/src/theme/tokens';

export const budgetStyles = StyleSheet.create({
  screen: { gap: spacing.lg, paddingTop: spacing.md },
  heading: { fontSize: 30, lineHeight: 36 },
  panel: { borderWidth: 1, borderRadius: radii.md, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  copy: { flex: 1, minWidth: 140, gap: spacing.xs },
  list: { paddingBottom: 120, gap: spacing.md },
  choice: { minHeight: 48, padding: spacing.md, borderWidth: 1, borderRadius: radii.sm, justifyContent: 'center' },
});

export function BudgetPanel({ children }: PropsWithChildren) {
  const theme = useIgnisTheme();
  return <View style={[budgetStyles.panel, { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }]}>{children}</View>;
}

export function BudgetError({ message }: { message: string | null }) {
  const theme = useIgnisTheme();
  return message ? <AppText accessibilityRole="alert" style={{ color: theme.colors.danger }}>{message}</AppText> : null;
}

export function BudgetReady({ children }: PropsWithChildren) {
  const budget = useBudget();
  if (budget.loading) return <Screen contentStyle={budgetStyles.screen}><AppText accessibilityRole="progressbar">Loading budget…</AppText></Screen>;
  // A failed initial read has no category seed, and must not show an editable empty ledger.
  if (budget.error && budget.categories.length === 0) return (
    <Screen contentStyle={budgetStyles.screen}>
      <BudgetError message={budget.error} />
      <ActionButton label="Try budget again" onPress={() => { budget.refresh().catch(() => undefined); }} />
    </Screen>
  );
  return children;
}

export function useBudgetExit(dirty: boolean, busy: boolean) {
  const navigation = useNavigation();
  const confirm = useConfirm();
  const allowExit = useRef(false);
  usePreventRemove(dirty || busy, async ({ data }) => {
    if (allowExit.current) return navigation.dispatch(data.action);
    if (busy) return;
    if (await confirm({ title: 'Discard unsaved changes?', message: 'Your budget edits have not been saved.', confirmText: 'Discard', cancelText: 'Keep editing', destructive: true })) {
      allowExit.current = true;
      navigation.dispatch(data.action);
    }
  });
  return allowExit;
}
