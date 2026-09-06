import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { BudgetError, BudgetPanel, BudgetReady, budgetStyles as styles, useBudgetExit } from '@/src/components/budget-shared';
import { ActionButton, AppText, FormField, IconButton, Screen } from '@/src/components/primitives';
import { useBudget } from '@/src/providers/budget-provider';
import { useConfirm } from '@/src/providers/feedback-provider';

export function BudgetCategoriesScreen() {
  const { categories } = useBudget();
  return (
    <BudgetReady>
      <Screen scroll contentStyle={styles.screen}>
        <AppText variant="title" style={styles.heading}>Expense categories</AppText>
        <AppText variant="muted">Rename categories to suit your spending. Archiving hides them from new entries and keeps your history.</AppText>
        <ActionButton label="Add category" icon="add" onPress={() => router.push('/budget/category/new')} />
        {categories.map((category) => (
          <BudgetPanel key={category.id}>
            <View style={styles.row}>
              <View style={styles.copy}><AppText variant="title">{category.name}</AppText><AppText variant="muted">{category.archived ? 'Archived' : 'Active'}</AppText></View>
              <IconButton icon="edit" label={`Edit ${category.name}`} onPress={() => router.push({ pathname: '/budget/category/[id]', params: { id: category.id } })} />
            </View>
          </BudgetPanel>
        ))}
      </Screen>
    </BudgetReady>
  );
}

export function BudgetCategoryEditor({ id }: { id: string }) {
  const budget = useBudget();
  const existing = budget.categories.find((category) => category.id === id);
  const [categoryId] = useState(() => existing?.id ?? randomUUID());
  const [name, setName] = useState(existing?.name ?? '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const allowExit = useBudgetExit(dirty, busy);
  const confirm = useConfirm();

  async function perform(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      allowExit.current = true;
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The category could not be saved.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function archive() {
    if (!existing || busyRef.current) return;
    const verb = existing.archived ? 'Restore' : 'Archive';
    const confirmed = await confirm({ title: `${verb} ${existing.name}?`, message: existing.archived ? 'This category will be available for new expenses.' : 'Existing expenses keep this category. New expenses will use another category.', confirmText: verb });
    if (confirmed) await perform(() => budget.archiveCategory(existing.id, !existing.archived));
  }

  if (id !== 'new' && !existing) return <Screen contentStyle={styles.screen}><AppText variant="title">Category not found</AppText><ActionButton label="Back to categories" onPress={() => router.replace('/budget/categories')} /></Screen>;

  return (
    <Screen scroll contentStyle={styles.screen}>
      <AppText variant="title" style={styles.heading}>{existing ? 'Edit category' : 'Add category'}</AppText>
      <AppText variant="muted">Renaming updates the label on historical expenses too.</AppText>
      <FormField label="Category name" accessibilityLabel="Category name" value={name} maxLength={40} editable={!busy} onChangeText={(value) => { setName(value); setDirty(true); }} />
      <BudgetError message={error} />
      <ActionButton label="Save category" loading={busy} onPress={() => perform(() => budget.saveCategory(categoryId, name, Boolean(existing)))} />
      {existing ? <ActionButton label={existing.archived ? 'Restore category' : 'Archive category'} kind="outlined" disabled={busy || dirty} onPress={archive} /> : null}
      {existing && dirty ? <AppText variant="muted">Save the new name before changing archive status.</AppText> : null}
    </Screen>
  );
}
