import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { authStorage } from '@/src/data/storage-adapter';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockSecureStore = SecureStore as unknown as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

describe('authStorage adapter', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();

    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => store.get(key) ?? null);
    mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
    });
    mockSecureStore.deleteItemAsync.mockImplementation(async (key: string) => {
      store.delete(key);
    });
  });

  describe('native platform', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    test('stores and retrieves values within single-chunk limit', async () => {
      const key = 'sb-test-auth-token';
      const value = JSON.stringify({ access_token: 'token123', refresh_token: 'refresh123' });

      await authStorage.setItem(key, value);
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(key, value);

      const retrieved = await authStorage.getItem(key);
      expect(retrieved).toBe(value);
    });

    test('chunks and reassembles values exceeding single-chunk limit', async () => {
      const key = 'sb-large-auth-token';
      const largeValue = 'A'.repeat(4000);

      await authStorage.setItem(key, largeValue);

      // Should write sentinel to base key and chunk keys
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(key, '__CHUNKED__:3');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(`${key}.0`, 'A'.repeat(1800));
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(`${key}.1`, 'A'.repeat(1800));
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(`${key}.2`, 'A'.repeat(400));

      const retrieved = await authStorage.getItem(key);
      expect(retrieved).toBe(largeValue);
    });

    test('cleans up previous chunks when overwriting large value with small value', async () => {
      const key = 'sb-token';
      const largeValue = 'B'.repeat(3800);
      await authStorage.setItem(key, largeValue);

      expect(store.has(`${key}.0`)).toBe(true);
      expect(store.has(`${key}.1`)).toBe(true);
      expect(store.has(`${key}.2`)).toBe(true);

      // Now overwrite with small value
      const smallValue = 'small-token';
      await authStorage.setItem(key, smallValue);

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(`${key}.0`);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(`${key}.1`);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(`${key}.2`);

      const retrieved = await authStorage.getItem(key);
      expect(retrieved).toBe(smallValue);
    });

    test('removes all chunks when removeItem is called on chunked item', async () => {
      const key = 'sb-token-to-delete';
      const largeValue = 'C'.repeat(3000);
      await authStorage.setItem(key, largeValue);

      await authStorage.removeItem(key);

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(`${key}.0`);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(`${key}.1`);

      const retrieved = await authStorage.getItem(key);
      expect(retrieved).toBeNull();
    });

    test('returns null gracefully if SecureStore throws an error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('KeyStore unavailable'));
      const result = await authStorage.getItem('any-key');
      expect(result).toBeNull();
    });
  });

  describe('web platform', () => {
    const originalLocalStorage = global.localStorage;

    beforeEach(() => {
      Platform.OS = 'web';
    });

    afterEach(() => {
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      });
    });

    test('uses window.localStorage when available', async () => {
      const mockStorage: Record<string, string> = {};
      const fakeLocalStorage = {
        getItem: jest.fn((k: string) => mockStorage[k] ?? null),
        setItem: jest.fn((k: string, v: string) => {
          mockStorage[k] = v;
        }),
        removeItem: jest.fn((k: string) => {
          delete mockStorage[k];
        }),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };

      Object.defineProperty(window, 'localStorage', {
        value: fakeLocalStorage,
        writable: true,
      });

      await authStorage.setItem('web-key', 'web-value');
      expect(fakeLocalStorage.setItem).toHaveBeenCalledWith('web-key', 'web-value');

      const retrieved = await authStorage.getItem('web-key');
      expect(retrieved).toBe('web-value');

      await authStorage.removeItem('web-key');
      expect(fakeLocalStorage.removeItem).toHaveBeenCalledWith('web-key');
    });
  });
});
