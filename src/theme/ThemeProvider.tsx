import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { palettes, type ThemeColors, type ThemeMode } from './palette';
import { createThemePreference } from './preference';

const preference = createThemePreference(Platform.OS === 'web' ? {
  async getItem(key) { return window.localStorage.getItem(key); },
  async setItem(key, value) { window.localStorage.setItem(key, value); },
} : {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
});

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, updateMode] = useState<ThemeMode>('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    void preference.load().then((value) => {
      if (active) updateMode(value);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível ler o tema salvo. Escolha o tema novamente.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function setMode(next: ThemeMode) {
    if (loading || pending.current) return;
    pending.current = true;
    setSaving(true); setError(null); updateMode(next);
    try {
      await preference.save(next);
    } catch {
      setError('Tema aplicado, mas não foi possível salvar a preferência neste aparelho. Selecione o tema novamente para tentar salvar.');
    } finally {
      pending.current = false; setSaving(false);
    }
  }

  return <ThemeContext.Provider value={{ mode, colors: palettes[mode], loading, saving, error, setMode }}>
    {children}
  </ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('O tema deve ser usado dentro do ThemeProvider.');
  return context;
}

export function useThemedStyles<T>(factory: (colors: ThemeColors) => T) {
  const theme = useTheme();
  const styles = useMemo(() => factory(theme.colors), [factory, theme.colors]);
  return { ...theme, styles };
}
