const MANIFEST_VERSION = 1;
const DEFAULT_MAX_CHUNK_BYTES = 1800;
const MAX_MANIFEST_ITEMS = 8;
const MAX_CHUNKS_PER_ITEM = 512;
const POINTER_KEY = 'aligner.cloud-auth.installation.v1';

type SecureStoreOptions = {
  keychainAccessible?: number;
};

export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

type StoredItem = {
  generation: string;
  chunkCount: number;
};

type SessionManifest = {
  version: 1;
  installationId: string;
  items: Record<string, StoredItem>;
};

type StorageOptions = {
  maxChunkBytes?: number;
  keychainAccessible?: number;
  createGeneration: () => string;
};

function utf8ByteLength(value: string) {
  const codePoint = value.codePointAt(0) ?? 0;
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

export function splitIntoUtf8Chunks(value: string, maxBytes = DEFAULT_MAX_CHUNK_BYTES) {
  if (!Number.isInteger(maxBytes) || maxBytes < 4) {
    throw new Error('Secure session chunk size is invalid.');
  }

  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;

  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (chunk && chunkBytes + characterBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }

  if (chunk || value.length === 0) {
    chunks.push(chunk);
  }

  return chunks;
}

function isStoredItem(value: unknown): value is StoredItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredItem>;
  return (
    typeof item.generation === 'string' &&
    /^[a-zA-Z0-9-]+$/.test(item.generation) &&
    Number.isInteger(item.chunkCount) &&
    (item.chunkCount ?? 0) > 0 &&
    (item.chunkCount ?? 0) <= MAX_CHUNKS_PER_ITEM
  );
}

function parseManifest(value: string | null, installationId: string): SessionManifest | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<SessionManifest>;
    if (
      parsed.version !== MANIFEST_VERSION ||
      parsed.installationId !== installationId ||
      !parsed.items ||
      typeof parsed.items !== 'object' ||
      Array.isArray(parsed.items)
    ) {
      return null;
    }

    const entries = Object.entries(parsed.items);
    if (entries.length > MAX_MANIFEST_ITEMS || entries.some(([, item]) => !isStoredItem(item))) {
      return null;
    }

    return parsed as SessionManifest;
  } catch {
    return null;
  }
}

function manifestKey(installationId: string) {
  return `aligner.cloud-auth.${installationId}.manifest.v1`;
}

function chunkKey(installationId: string, generation: string, index: number) {
  return `aligner.cloud-auth.${installationId}.${generation}.${index}`;
}

export function createSecureSessionStorage(
  secureStore: SecureStoreLike,
  installationId: string,
  options: StorageOptions,
) {
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(installationId)) {
    throw new Error('Local installation metadata is invalid.');
  }

  const maxChunkBytes = options.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  const secureStoreOptions = { keychainAccessible: options.keychainAccessible };
  let operation = Promise.resolve();

  async function deleteChunks(targetInstallationId: string, item: StoredItem) {
    const results = await Promise.allSettled(
      Array.from({ length: item.chunkCount }, (_, index) =>
        secureStore.deleteItemAsync(chunkKey(targetInstallationId, item.generation, index)),
      ),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }

  async function cleanupInstallation(targetInstallationId: string) {
    const targetManifestKey = manifestKey(targetInstallationId);
    const rawManifest = await secureStore.getItemAsync(targetManifestKey);
    const manifest = parseManifest(rawManifest, targetInstallationId);

    if (manifest) {
      await Promise.all(Object.values(manifest.items).map((item) => deleteChunks(targetInstallationId, item)));
    }
    await secureStore.deleteItemAsync(targetManifestKey);
  }

  async function ensureCurrentInstallation() {
    const previousInstallationId = await secureStore.getItemAsync(POINTER_KEY);
    if (previousInstallationId && previousInstallationId !== installationId) {
      if (/^[a-zA-Z0-9-]{1,128}$/.test(previousInstallationId)) {
        await cleanupInstallation(previousInstallationId);
      } else {
        await secureStore.deleteItemAsync(POINTER_KEY);
      }
    }
    if (previousInstallationId !== installationId) {
      await secureStore.setItemAsync(POINTER_KEY, installationId, secureStoreOptions);
    }
  }

  async function readManifest() {
    await ensureCurrentInstallation();
    const key = manifestKey(installationId);
    const rawManifest = await secureStore.getItemAsync(key);
    const manifest = parseManifest(rawManifest, installationId);

    if (rawManifest && !manifest) {
      await secureStore.deleteItemAsync(key);
    }

    return manifest;
  }

  function serialized<T>(task: () => Promise<T>) {
    const next = operation.then(task, task);
    operation = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function getItemInternal(key: string) {
    const manifest = await readManifest();
    const item = manifest?.items[key];
    if (!manifest || !item) return null;

    const chunks = await Promise.all(
      Array.from({ length: item.chunkCount }, (_, index) =>
        secureStore.getItemAsync(chunkKey(installationId, item.generation, index)),
      ),
    );

    if (chunks.some((chunk) => chunk === null)) {
      const nextItems = { ...manifest.items };
      delete nextItems[key];
      await deleteChunks(installationId, item);
      if (Object.keys(nextItems).length === 0) {
        await secureStore.deleteItemAsync(manifestKey(installationId));
      } else {
        await secureStore.setItemAsync(
          manifestKey(installationId),
          JSON.stringify({ ...manifest, items: nextItems }),
          secureStoreOptions,
        );
      }
      return null;
    }

    return chunks.join('');
  }

  async function setItemInternal(key: string, value: string) {
    const manifest =
      (await readManifest()) ??
      ({ version: MANIFEST_VERSION, installationId, items: {} } satisfies SessionManifest);
    const previousItem = manifest.items[key];
    const generation = options.createGeneration();
    if (!/^[a-zA-Z0-9-]+$/.test(generation)) {
      throw new Error('Secure session generation is invalid.');
    }
    if (!previousItem && Object.keys(manifest.items).length >= MAX_MANIFEST_ITEMS) {
      throw new Error('Secure session storage limit was exceeded.');
    }
    const chunks = splitIntoUtf8Chunks(value, maxChunkBytes);
    const nextItem = { generation, chunkCount: chunks.length };

    try {
      for (const [index, chunk] of chunks.entries()) {
        await secureStore.setItemAsync(
          chunkKey(installationId, generation, index),
          chunk,
          secureStoreOptions,
        );
      }
      await secureStore.setItemAsync(
        manifestKey(installationId),
        JSON.stringify({ ...manifest, items: { ...manifest.items, [key]: nextItem } }),
        secureStoreOptions,
      );
    } catch (error) {
      await deleteChunks(installationId, nextItem);
      throw error;
    }

    if (previousItem) {
      await deleteChunks(installationId, previousItem);
    }
  }

  async function removeItemInternal(key: string) {
    const manifest = await readManifest();
    const item = manifest?.items[key];
    if (!manifest || !item) return;

    const nextItems = { ...manifest.items };
    delete nextItems[key];
    await deleteChunks(installationId, item);
    if (Object.keys(nextItems).length === 0) {
      await secureStore.deleteItemAsync(manifestKey(installationId));
    } else {
      await secureStore.setItemAsync(
        manifestKey(installationId),
        JSON.stringify({ ...manifest, items: nextItems }),
        secureStoreOptions,
      );
    }
  }

  return {
    getItem: (key: string) => serialized(() => getItemInternal(key)),
    setItem: (key: string, value: string) => serialized(() => setItemInternal(key, value)),
    removeItem: (key: string) => serialized(() => removeItemInternal(key)),
    clear: () =>
      serialized(async () => {
        await ensureCurrentInstallation();
        await cleanupInstallation(installationId);
      }),
  };
}
