/**
 * Web storage and OPFS (Origin Private File System) helpers for SQLite web support.
 */

export function isOpfsLockError(error: unknown): boolean {
  if (!error) return false;
  const message = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? `${error.name} ${error.message}` 
      : String(error);

  return (
    message.includes('createSyncAccessHandle') ||
    message.includes('NoModificationAllowedError') ||
    message.includes('Access Handles cannot be created') ||
    message.includes('another open Access Handle') ||
    message.includes('Writable stream associated with the same file') ||
    message.includes('database is locked')
  );
}

export interface DatabaseErrorInfo {
  isLockError: boolean;
  title: string;
  description: string;
  technicalDetails: string;
}

export function getDatabaseErrorInfo(error: Error): DatabaseErrorInfo {
  const isLock = isOpfsLockError(error);
  
  if (isLock) {
    return {
      isLockError: true,
      title: 'Database locked by another tab',
      description:
        'Ignis uses high-performance browser storage (OPFS) which can only be active in one tab at a time. Please close any other open tabs or windows of Ignis and try again.',
      technicalDetails: error.message || error.name || 'OPFS sync handle collision.',
    };
  }

  return {
    isLockError: false,
    title: 'The schedule did not open',
    description: error.message || 'Ignis could not open or initialize its local database.',
    technicalDetails: error.stack || error.message || String(error),
  };
}

/**
 * Attempts to clear the Origin Private File System (OPFS) directory entries.
 * Useful when stale or orphaned file handles prevent opening the database.
 */
export async function clearWebOpfsStorage(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !navigator.storage?.getDirectory
  ) {
    return false;
  }

  try {
    const root = await navigator.storage.getDirectory();
    // @ts-ignore - values() or async iterator
    if (typeof root.values === 'function') {
      // @ts-ignore
      for await (const handle of root.values()) {
        try {
          await root.removeEntry(handle.name, { recursive: true });
        } catch {
          // ignore individual entry deletion failure
        }
      }
    } else if ((root as any)[Symbol.asyncIterator]) {
      for await (const [name] of root as any) {
        try {
          await root.removeEntry(name, { recursive: true });
        } catch {
          // ignore individual entry deletion failure
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('Failed to clear OPFS storage:', err);
    return false;
  }
}
