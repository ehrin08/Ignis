import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';

import { BudgetError, BudgetPanel, BudgetReady, budgetStyles as styles } from '@/src/components/budget-shared';
import { ActionButton, AppText, Screen } from '@/src/components/primitives';
import { BUDGET_BACKUP_NOTICE, formatBudgetCurrency } from '@/src/domain/budget';
import { useBudget } from '@/src/providers/budget-provider';
import { spacing, useIgnisTheme } from '@/src/theme/tokens';

export function BudgetScreen() {
  const { entries, categories, totals, error, refresh } = useBudget();
  const theme = useIgnisTheme();
  const money = formatBudgetCurrency;
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  return (
    <BudgetReady>
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="title" style={styles.heading}>Budget</AppText>
                <AppText variant="muted">Manual PHP ledger · Separate from pay</AppText>
              </View>
              <BudgetPanel>
                <AppText variant="label">Available balance</AppText>
                <AppText variant="displayStrong" adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={`Available balance ${money(totals.balanceMinor)}`}>
                  {money(totals.balanceMinor)}
                </AppText>
                {totals.balanceMinor < 0 ? <AppText variant="label" style={{ color: theme.colors.danger }}>Shortfall · {money(-totals.balanceMinor)}</AppText> : null}
                <View style={styles.row}>
                  <View style={styles.copy}><AppText variant="muted">Total funds added</AppText><AppText numberOfLines={1} adjustsFontSizeToFit>{money(totals.fundsMinor)}</AppText></View>
                  <View style={styles.copy}><AppText variant="muted">Total expenses</AppText><AppText numberOfLines={1} adjustsFontSizeToFit>{money(totals.expensesMinor)}</AppText></View>
                </View>
              </BudgetPanel>
              <View style={styles.row}>
                <ActionButton style={{ flex: 1, minWidth: 140 }} icon="add" label="Add funds" kind="outlined" onPress={() => router.push('/budget/entry/new?kind=funds')} />
                <ActionButton style={{ flex: 1, minWidth: 140 }} icon="remove" label="Add expense" onPress={() => router.push('/budget/entry/new?kind=expense')} />
              </View>
              <AppText variant="muted">{BUDGET_BACKUP_NOTICE}.</AppText>
              <ActionButton kind="outlined" label="Manage categories" onPress={() => router.push('/budget/categories')} />
              <BudgetError message={error} />
              {error ? <ActionButton kind="outlined" label="Reload budget" onPress={() => { refresh().catch(() => undefined); }} /> : null}
              <AppText variant="title">Transactions</AppText>
            </View>
          }
          ListEmptyComponent={<BudgetPanel><AppText variant="title">Your ledger starts here</AppText><AppText variant="muted">Add the funds you have available, then record expenses as you spend. Nothing is added from your salary.</AppText></BudgetPanel>}
          renderItem={({ item }) => {
            const label = item.kind === 'funds' ? 'Funds added' : categoryNames.get(item.categoryId ?? '') ?? 'Expense';
            const date = new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.kind === 'funds' ? 'funds' : 'expense'}, ${label}, ${money(item.amountMinor)}, ${date}${item.description ? `, ${item.description}` : ''}`}
                onPress={() => router.push({ pathname: '/budget/entry/[id]', params: { id: item.id } })}
                style={({ pressed }) => [styles.panel, { borderColor: theme.colors.outline, opacity: pressed ? 0.72 : 1 }]}>
                <View style={styles.row}>
                  <MaterialIcons name={item.kind === 'funds' ? 'add-circle-outline' : 'remove-circle-outline'} color={theme.colors.ink} size={24} />
                  <View style={styles.copy}>
                    <AppText variant="label">{label}</AppText>
                    <AppText variant="muted">{item.kind === 'expense' ? 'Expense · ' : ''}{date}</AppText>
                  </View>
                  <AppText numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: '100%' }}>{item.kind === 'funds' ? '+' : '−'}{money(item.amountMinor)}</AppText>
                </View>
                {item.description ? <AppText numberOfLines={2}>{item.description}</AppText> : null}
              </Pressable>
            );
          }}
        />
      </Screen>
    </BudgetReady>
  );
}
