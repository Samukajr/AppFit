import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { getSupabaseClient } from '../../lib/supabase/client';

type AuthState = {
  client: SupabaseClient | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      return { client: getSupabaseClient(), session: null, loading: true, error: null };
    } catch (cause) {
      return { client: null, session: null, loading: false,
        error: cause instanceof Error ? cause.message : 'Falha ao configurar autenticação.' };
    }
  });
  const client = state.client;
  useEffect(() => {
    if (!client) return;
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      if (active) setState({ client, session, loading: false, error: null });
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (active && !authChanged) setState({ client, session: error ? null : data.session, loading: false, error: error?.message ?? null });
    }).catch((cause: unknown) => {
      if (active) setState({ client, session: null, loading: false,
        error: cause instanceof Error ? cause.message : 'Não foi possível recuperar sua sessão.' });
    });
    const refresh = (appState: string) => {
      if (appState === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    const appSubscription = Platform.OS === 'web' ? null : AppState.addEventListener('change', refresh);
    return () => {
      active = false;
      subscription.unsubscribe();
      appSubscription?.remove();
      if (Platform.OS !== 'web') client.auth.stopAutoRefresh();
    };
  }, [client]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider ausente.');
  return context;
}
