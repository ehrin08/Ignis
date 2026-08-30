import type { SQLiteDatabase } from 'expo-sqlite';

type TransactionTask<T = void> = (transaction: SQLiteDatabase) => Promise<T>;

let writeQueue: Promise<unknown> = Promise.resolve();

export async function runSerializedWrite<T>(task: () => Promise<T>): Promise<T> {
  const nextTask = writeQueue.then(task, task);
  writeQueue = nextTask.then(
    () => {},
    () => {}
  );
  return nextTask;
}

export async function runWriteTransaction<T = void>(
  db: SQLiteDatabase,
  task: TransactionTask<T>
): Promise<T> {
  return runSerializedWrite(async () => {
    let result: T;
    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
    return result!;
  });
}
