import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const CHUNK_PREFIX = '__CHUNKED__:';

function splitIntoChunks(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

const memoryFallback = new Map<string, string>();

/**
 * Storage adapter implementing Supabase's SupportedStorage contract.
 * - Uses expo-secure-store on native platforms (Android/iOS) with automatic chunking for keys > 2KB.
 * - Uses window.localStorage on Web with an in-memory fallback for headless/SSR environments.
 */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return memoryFallback.get(key) ?? null;
      }

      const raw = await SecureStore.getItemAsync(key);
      if (!raw) return null;

      if (raw.startsWith(CHUNK_PREFIX)) {
        const count = parseInt(raw.slice(CHUNK_PREFIX.length), 10);
        if (Number.isNaN(count) || count <= 0) {
          return null;
        }

        const chunkPromises: Promise<string | null>[] = [];
        for (let i = 0; i < count; i += 1) {
          chunkPromises.push(SecureStore.getItemAsync(`${key}.${i}`));
        }

        const chunks = await Promise.all(chunkPromises);
        if (chunks.some((chunk) => chunk === null)) {
          return null;
        }

        return chunks.join('');
      }

      return raw;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        } else {
          memoryFallback.set(key, value);
        }
        return;
      }

      if (value.length <= CHUNK_SIZE) {
        // Read old value to see if chunk cleanup is required
        const existing = await SecureStore.getItemAsync(key);
        if (existing?.startsWith(CHUNK_PREFIX)) {
          const oldCount = parseInt(existing.slice(CHUNK_PREFIX.length), 10);
          if (!Number.isNaN(oldCount)) {
            await Promise.all(
              Array.from({ length: oldCount }, (_, i) =>
                SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => undefined)
              )
            );
          }
        }

        await SecureStore.setItemAsync(key, value);
      } else {
        const chunks = splitIntoChunks(value, CHUNK_SIZE);
        const existing = await SecureStore.getItemAsync(key);
        let oldCount = 0;
        if (existing?.startsWith(CHUNK_PREFIX)) {
          const parsed = parseInt(existing.slice(CHUNK_PREFIX.length), 10);
          if (!Number.isNaN(parsed)) oldCount = parsed;
        }

        // Write all new chunks
        await Promise.all(
          chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk))
        );

        // Delete any leftover chunks from an older write that had more chunks
        if (oldCount > chunks.length) {
          await Promise.all(
            Array.from({ length: oldCount - chunks.length }, (_, i) =>
              SecureStore.deleteItemAsync(`${key}.${chunks.length + i}`).catch(() => undefined)
            )
          );
        }

        // Store chunk count marker in base key
        await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);
      }
    } catch {
      // Best-effort storage write; ignore platform secure storage errors
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        } else {
          memoryFallback.delete(key);
        }
        return;
      }

      const existing = await SecureStore.getItemAsync(key);
      if (existing?.startsWith(CHUNK_PREFIX)) {
        const count = parseInt(existing.slice(CHUNK_PREFIX.length), 10);
        if (!Number.isNaN(count)) {
          await Promise.all(
            Array.from({ length: count }, (_, i) =>
              SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => undefined)
            )
          );
        }
      }

      await SecureStore.deleteItemAsync(key);
    } catch {
      // Best-effort removal
    }
  },
};
