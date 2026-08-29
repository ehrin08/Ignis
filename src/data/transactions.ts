import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

type TransactionTask = (transaction: SQLiteDatabase) => Promise<void>;

export async function runWriteTransaction(db: SQLiteDatabase, task: TransactionTask) {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => task(db));
    return;
  }

  await db.withExclusiveTransactionAsync(task);
}
