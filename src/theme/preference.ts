import type { ThemeMode } from './palette';

export const themePreferenceKey = 'marombafit.theme';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function createThemePreference(storage: Storage) {
  return {
    async load(): Promise<ThemeMode> {
      const value = await storage.getItem(themePreferenceKey);
      if (value === null) return 'light';
      if (value !== 'light' && value !== 'dark') throw new Error('Preferência de tema salva inválida. Escolha o tema novamente.');
      return value;
    },
    async save(mode: ThemeMode) {
      if (mode !== 'light' && mode !== 'dark') throw new Error('Tema inválido.');
      await storage.setItem(themePreferenceKey, mode);
    },
  };
}
