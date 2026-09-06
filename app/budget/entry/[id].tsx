import { useLocalSearchParams } from 'expo-router';
import { BudgetEntryEditor } from '@/src/components/budget-entry-editor';
import { BudgetReady } from '@/src/components/budget-shared';

export default function BudgetEntryRoute() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  return <BudgetReady><BudgetEntryEditor key={id} id={id} kind={kind === 'funds' ? 'funds' : 'expense'} /></BudgetReady>;
}
