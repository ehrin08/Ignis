import { Platform } from 'react-native';

import { runWriteTransaction } from '@/src/data/transactions';

describe('runWriteTransaction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses a regular transaction with the original database on web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const task = jest.fn(async () => undefined);
    let db: {
      withTransactionAsync: (callback: () => Promise<void>) => Promise<void>;
      withExclusiveTransactionAsync: jest.Mock;
    };
    db = {
      withTransactionAsync: jest.fn(async (callback) => callback()),
      withExclusiveTransactionAsync: jest.fn(),
    };

    await runWriteTransaction(db as never, task);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    expect(task).toHaveBeenCalledWith(db);
  });

  test('uses the exclusive transaction object on native platforms', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const transaction = { connection: 'exclusive' };
    const task = jest.fn(async () => undefined);
    const db = {
      withTransactionAsync: jest.fn(),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: unknown) => Promise<void>) => callback(transaction)),
    };

    await runWriteTransaction(db as never, task);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(task).toHaveBeenCalledWith(transaction);
  });

  test('propagates callback failures', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const failure = new Error('write failed');
    const db = {
      withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
      withExclusiveTransactionAsync: jest.fn(),
    };

    await expect(runWriteTransaction(db as never, async () => {
      throw failure;
    })).rejects.toBe(failure);
  });
});
