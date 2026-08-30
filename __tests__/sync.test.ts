jest.mock('@/src/data/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'device-test') }));

import { syncAccount } from '@/src/data/sync';
import { supabase } from '@/src/data/supabase';

const mockRpc = supabase!.rpc as jest.Mock;

function databaseDouble(initialState: Record<string, string> = {}) {
  const state = new Map(Object.entries(initialState));
  const execStatements: string[] = [];
  const db = {
    getFirstAsync: jest.fn(async (sql: string, key?: string) => {
      if (sql.includes('sync_state')) {
        const value = state.get(String(key));
        return value ? { value } : null;
      }
      return null;
    }),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async (sql: string, ...parameters: unknown[]) => {
      if (sql.includes('INSERT INTO sync_state')) state.set(String(parameters[0]), String(parameters[1]));
      if (sql.includes('DELETE FROM sync_state')) state.delete(String(parameters[0]));
    }),
    execAsync: jest.fn(async (sql: string) => { execStatements.push(sql); }),
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => callback()),
  };
  return { db, state, execStatements };
}

describe('account sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: { deviceId: 'server', settings: null, series: [], duties: [], exceptions: [], tombstones: [] },
      error: null,
    });
  });

  test('binds guest data to the account and sends a typed snapshot', async () => {
    const { db, state } = databaseDouble();

    await syncAccount(db as never, 'user-1');

    expect(mockRpc).toHaveBeenCalledWith('sync_ignis_snapshot', {
      p_snapshot: expect.objectContaining({
        deviceId: expect.any(String),
        settings: null,
        series: [],
        duties: [],
        exceptions: [],
        tombstones: [],
      }),
    });
    expect(state.get('owner_id')).toBe('user-1');
    expect(state.get('last_sync_at')).toEqual(expect.any(String));
  });

  test('clears a previous account cache before pulling another account', async () => {
    const { db, execStatements } = databaseDouble({ owner_id: 'user-old', device_id: 'device-a' });

    await syncAccount(db as never, 'user-new');

    expect(execStatements.join('\n')).toContain('DELETE FROM scheduled_duties');
  });
});
