import {
  createSecureSessionStorage,
  type SecureStoreLike,
  splitIntoUtf8Chunks,
} from '@/features/cloud-auth/secure-session-storage';

function createMemorySecureStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const store: SecureStoreLike = {
    getItemAsync: jest.fn(async (key) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      values.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      values.delete(key);
    }),
  };
  return { store, values };
}

describe('secure session storage', () => {
  it('splits by UTF-8 bytes without separating Unicode code points', () => {
    expect(splitIntoUtf8Chunks('a😀b', 4)).toEqual(['a', '😀', 'b']);
  });

  it('round-trips sessions larger than 2 KB and removes every chunk', async () => {
    const { store, values } = createMemorySecureStore();
    const storage = createSecureSessionStorage(store, 'install-a', {
      createGeneration: () => 'generation-a',
      maxChunkBytes: 1000,
      keychainAccessible: 7,
    });
    const session = JSON.stringify({ access_token: 'x'.repeat(3500) });

    await storage.setItem('session', session);

    expect(await storage.getItem('session')).toBe(session);
    expect([...values.keys()].filter((key) => key.includes('generation-a'))).toHaveLength(4);
    expect(store.setItemAsync).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      keychainAccessible: 7,
    });

    await storage.removeItem('session');

    expect(await storage.getItem('session')).toBeNull();
    expect([...values.keys()].some((key) => key.includes('generation-a'))).toBe(false);
  });

  it('commits an overwrite before cleaning up the old chunks', async () => {
    const { store, values } = createMemorySecureStore();
    let generation = 'old';
    const storage = createSecureSessionStorage(store, 'install-a', {
      createGeneration: () => generation,
      maxChunkBytes: 8,
    });
    await storage.setItem('session', 'old-session');
    generation = 'new';

    await storage.setItem('session', 'new-session');

    expect(await storage.getItem('session')).toBe('new-session');
    expect([...values.keys()].some((key) => key.includes('.old.'))).toBe(false);
  });

  it('keeps the prior committed value if writing a new manifest fails', async () => {
    const { store } = createMemorySecureStore();
    let generation = 'old';
    const storage = createSecureSessionStorage(store, 'install-a', {
      createGeneration: () => generation,
      maxChunkBytes: 8,
    });
    await storage.setItem('session', 'old-session');
    generation = 'new';
    const setItem = store.setItemAsync as jest.Mock;
    setItem.mockImplementationOnce(async (key: string, value: string) => undefined);
    setItem.mockImplementationOnce(async (key: string, value: string) => undefined);
    setItem.mockImplementationOnce(async () => {
      throw new Error('Keychain write failed');
    });

    await expect(storage.setItem('session', 'new-session')).rejects.toThrow('Keychain write failed');
    expect(await storage.getItem('session')).toBe('old-session');
  });

  it('returns no session for a corrupt or incomplete manifest', async () => {
    const corrupt = createMemorySecureStore({
      'aligner.cloud-auth.installation.v1': 'install-a',
      'aligner.cloud-auth.install-a.manifest.v1': '{bad json',
    });
    const corruptStorage = createSecureSessionStorage(corrupt.store, 'install-a', {
      createGeneration: () => 'unused',
    });
    expect(await corruptStorage.getItem('session')).toBeNull();

    const incomplete = createMemorySecureStore();
    const incompleteStorage = createSecureSessionStorage(incomplete.store, 'install-a', {
      createGeneration: () => 'missing',
    });
    await incompleteStorage.setItem('session', 'a'.repeat(2000));
    const chunk = [...incomplete.values.keys()].find((key) => key.endsWith('.1'))!;
    incomplete.values.delete(chunk);

    expect(await incompleteStorage.getItem('session')).toBeNull();
  });

  it('deletes a prior installation session and requires sign-in again', async () => {
    const { store, values } = createMemorySecureStore();
    const oldStorage = createSecureSessionStorage(store, 'old-install', {
      createGeneration: () => 'old-generation',
    });
    await oldStorage.setItem('session', 'persisted-session');

    const newStorage = createSecureSessionStorage(store, 'new-install', {
      createGeneration: () => 'new-generation',
    });

    expect(await newStorage.getItem('session')).toBeNull();
    expect([...values.keys()].some((key) => key.includes('old-install'))).toBe(false);
  });
});
