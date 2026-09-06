import { useLocalSearchParams } from 'expo-router';
import { BudgetCategoryEditor } from '@/src/components/budget-categories';
import { BudgetReady } from '@/src/components/budget-shared';

export default function BudgetCategoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BudgetReady><BudgetCategoryEditor key={id} id={id} /></BudgetReady>;
}
