import { getDatabaseErrorInfo, isOpfsLockError, clearWebOpfsStorage } from '@/src/utils/web-storage';

describe('web-storage utilities', () => {
  describe('isOpfsLockError', () => {
    it('returns true for createSyncAccessHandle error messages', () => {
      const error = new Error(
        "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file."
      );
      error.name = 'NoModificationAllowedError';
      expect(isOpfsLockError(error)).toBe(true);
    });

    it('returns true for raw string errors mentioning OPFS access handles', () => {
      expect(
        isOpfsLockError(
          "NoModificationAllowedError: Access Handles cannot be created if there is another open Access Handle"
        )
      ).toBe(true);
    });

    it('returns true for database is locked errors', () => {
      expect(isOpfsLockError(new Error('database is locked'))).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isOpfsLockError(new Error('Syntax error in SQL statement'))).toBe(false);
      expect(isOpfsLockError(null)).toBe(false);
      expect(isOpfsLockError(undefined)).toBe(false);
    });
  });

  describe('getDatabaseErrorInfo', () => {
    it('provides multi-tab guidance for OPFS lock errors', () => {
      const error = new Error(
        "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle"
      );
      error.name = 'NoModificationAllowedError';

      const info = getDatabaseErrorInfo(error);
      expect(info.isLockError).toBe(true);
      expect(info.title).toContain('another tab');
      expect(info.description).toContain('close any other open tabs');
    });

    it('provides standard error message for generic errors', () => {
      const error = new Error('Disk full or table missing');
      const info = getDatabaseErrorInfo(error);
      expect(info.isLockError).toBe(false);
      expect(info.title).toBe('The schedule did not open');
      expect(info.description).toBe('Disk full or table missing');
    });
  });

  describe('clearWebOpfsStorage', () => {
    it('returns false safely when navigator storage is not available in test environment', async () => {
      const result = await clearWebOpfsStorage();
      expect(result).toBe(false);
    });
  });
});
