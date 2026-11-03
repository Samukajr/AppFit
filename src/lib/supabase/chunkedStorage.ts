export type StringStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type Manifest = { revision: string; count: number };

function parseManifest(value: string): Manifest {
  const data: unknown = JSON.parse(value);
  if (!data || typeof data !== 'object' || !('revision' in data) || !('count' in data) ||
      typeof data.revision !== 'string' || !/^[a-z0-9-]+$/.test(data.revision) ||
      typeof data.count !== 'number' || !Number.isInteger(data.count) || data.count < 1 || data.count > 256) {
    throw new Error('Sessão armazenada inválida. Limpe os dados do app para entrar novamente.');
  }
  return { revision: data.revision, count: data.count };
}

export function createChunkedStorage(storage: StringStorage): StringStorage {
  const manifestKey = (key: string) => `${key}.manifest`;
  const chunkKey = (key: string, manifest: Manifest, index: number) => `${key}.${manifest.revision}.${index}`;
  async function manifest(key: string) {
    const value = await storage.getItem(manifestKey(key));
    return value === null ? null : parseManifest(value);
  }
  async function removeChunks(key: string, entry: Manifest) {
    for (let i = 0; i < entry.count; i++) await storage.removeItem(chunkKey(key, entry, i));
  }
  return {
    async getItem(key) {
      const entry = await manifest(key);
      if (!entry) return null;
      let value = '';
      for (let i = 0; i < entry.count; i++) {
        const chunk = await storage.getItem(chunkKey(key, entry, i));
        if (chunk === null) throw new Error('Sessão armazenada incompleta. Limpe os dados do app para entrar novamente.');
        value += chunk;
      }
      return value;
    },
    async setItem(key, value) {
      const previous = await manifest(key);
      // Small chunks also fit platforms with historical 2 KB secure-value limits.
      const count = Math.max(1, Math.ceil(value.length / 500));
      if (count > 256) throw new Error('Sessão excede o tamanho permitido para armazenamento seguro.');
      const next = { revision: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count };
      for (let i = 0; i < count; i++) await storage.setItem(chunkKey(key, next, i), value.slice(i * 500, (i + 1) * 500));
      await storage.setItem(manifestKey(key), JSON.stringify(next));
      if (previous) await removeChunks(key, previous);
    },
    async removeItem(key) {
      const previous = await manifest(key);
      await storage.removeItem(manifestKey(key));
      if (previous) await removeChunks(key, previous);
    },
  };
}
