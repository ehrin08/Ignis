import DateTimePicker from '@react-native-community/datetimepicker';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { BudgetError, budgetStyles as styles, useBudgetExit } from '@/src/components/budget-shared';
import { ActionButton, AppText, FormField, Screen } from '@/src/components/primitives';
import { BudgetKind, budgetAmountText, parseBudgetAmount } from '@/src/domain/budget';
import { localDateKey } from '@/src/domain/format';
import { useBudget } from '@/src/providers/budget-provider';
import { useConfirm, useToast } from '@/src/providers/feedback-provider';
import { spacing, useIgnisTheme } from '@/src/theme/tokens';

export function BudgetEntryEditor({ id, kind }: { id: string; kind: BudgetKind }) {
  const budget = useBudget();
  const existing = budget.entries.find((entry) => entry.id === id);
  const entryKind = existing?.kind ?? kind;
  const [entryId] = useState(() => existing?.id ?? randomUUID());
  const [amount, setAmount] = useState(existing ? budgetAmountText(existing.amountMinor) : '');
  const [date, setDate] = useState(existing?.date ?? localDateKey(new Date()));
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? budget.categories.find((category) => category.id === 'other' && !category.archived)?.id ?? budget.categories.find((category) => !category.archived)?.id ?? '');
  const [picker, setPicker] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const allowExit = useBudgetExit(dirty, busy);
  const confirm = useConfirm();
  const toast = useToast();
  const theme = useIgnisTheme();

  async function save() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await budget.saveEntry({ id: entryId, kind: entryKind, amountMinor: parseBudgetAmount(amount), date, description, categoryId: entryKind === 'expense' ? categoryId : null }, Boolean(existing));
      allowExit.current = true;
      toast.success('Your budget entry is saved on this device.', 'Budget saved');
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The entry could not be saved. Try again.');
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function remove() {
    if (busyRef.current || !existing) return;
    if (!await confirm({ title: 'Delete budget entry?', message: 'This cannot be undone. Your available balance will be recalculated.', confirmText: 'Delete', destructive: true })) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await budget.deleteEntry(existing.id);
      allowExit.current = true;
      toast.success('Budget entry deleted.');
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The entry could not be deleted.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  if (id !== 'new' && !existing) return <Screen contentStyle={styles.screen}><AppText variant="title">Entry not found</AppText><ActionButton label="Back to budget" onPress={() => router.replace('/(tabs)/budget')} /></Screen>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll contentStyle={styles.screen}>
        <AppText variant="title" style={styles.heading}>{existing ? 'Edit' : 'Add'} {entryKind === 'funds' ? 'funds' : 'expense'}</AppText>
        <AppText variant="muted">Actual transactions in PHP. This entry changes only your budget.</AppText>
        <FormField accessibilityLabel="Amount in PHP" label="Amount · PHP" keyboardType="decimal-pad" value={amount} editable={!busy} onChangeText={(value) => { setAmount(value); setDirty(true); }} />
        <View style={{ gap: spacing.sm }}>
          {Platform.OS === 'web' ? (
            <FormField label="Date · YYYY-MM-DD" accessibilityLabel="Transaction date" value={date} editable={!busy} onChangeText={(value) => { setDate(value); setDirty(true); }} />
          ) : (
            <><AppText variant="label">Date</AppText><ActionButton kind="outlined" label={`Date: ${new Date(`${date}T12:00:00`).toLocaleDateString()}`} disabled={busy} onPress={() => setPicker(true)} /></>
          )}
        </View>
        {picker ? <DateTimePicker value={new Date(`${date}T12:00:00`)} maximumDate={new Date()} mode="date" onChange={(event, selected) => { setPicker(false); if (event.type === 'set' && selected) { setDate(localDateKey(selected)); setDirty(true); } }} /> : null}
        {entryKind === 'expense' ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label">Category</AppText>
            <View style={styles.row}>
              {budget.categories.filter((category) => !category.archived || category.id === existing?.categoryId).map((category) => (
                <Pressable key={category.id} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: categoryId === category.id, disabled: busy }}
                  onPress={() => { setCategoryId(category.id); setDirty(true); }}
                  style={[styles.choice, { borderColor: theme.colors.outline, backgroundColor: categoryId === category.id ? theme.colors.surfaceStrong : theme.colors.surface }]}>
                  <AppText style={{ color: categoryId === category.id ? theme.colors.onSurfaceStrong : theme.colors.ink }}>{category.name}{category.archived ? ' (archived)' : ''}</AppText>
                </Pressable>
              ))}
            </View>
            {!budget.categories.some((category) => !category.archived) ? <AppText variant="muted">No active categories. Add or restore a category before recording a new expense.</AppText> : null}
            <ActionButton label="Manage categories" kind="outlined" disabled={busy} onPress={() => router.push('/budget/categories')} />
          </View>
        ) : null}
        <FormField label="Description · optional" accessibilityLabel="Description" value={description} maxLength={500} multiline editable={!busy} onChangeText={(value) => { setDescription(value); setDirty(true); }} />
        <BudgetError message={error} />
        <ActionButton label="Save entry" loading={busy} onPress={save} />
        {existing ? <ActionButton kind="danger" label="Delete entry" disabled={busy} onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
