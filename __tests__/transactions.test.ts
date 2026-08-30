import { runWriteTransaction } from '@/src/data/transactions';

describe('runWriteTransaction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses withTransactionAsync on the primary database connection', async () => {
    const task = jest.fn(async () => undefined);
    const db = {
      withTransactionAsync: jest.fn(async (callback) => callback()),
    };

    await runWriteTransaction(db as never, task);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenCalledWith(db);
  });

  test('serializes concurrent write transactions in sequence', async () => {
    const executionOrder: number[] = [];
    const db = {
      withTransactionAsync: jest.fn(async (callback) => callback()),
    };

    const task1 = runWriteTransaction(db as never, async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      executionOrder.push(1);
    });
    const task2 = runWriteTransaction(db as never, async () => {
      executionOrder.push(2);
    });

    await Promise.all([task1, task2]);

    expect(executionOrder).toEqual([1, 2]);
  });

  test('propagates callback failures without blocking subsequent transactions', async () => {
    const failure = new Error('write failed');
    const db = {
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
    };

    await expect(
      runWriteTransaction(db as never, async () => {
        throw failure;
      })
    ).rejects.toBe(failure);

    const followUp = jest.fn(async () => 'recovered');
    const result = await runWriteTransaction(db as never, followUp);
    expect(result).toBe('recovered');
    expect(followUp).toHaveBeenCalledTimes(1);
  });
});
