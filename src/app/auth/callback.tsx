import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useAuth } from '../../features/auth/AuthProvider';
import { parseAuthCallback } from '../../features/auth/callback';
import { getAuthRedirectUrl } from '../../features/auth/redirect';
import { useThemedStyles, type ThemeColors } from '../../theme';

export default function AuthCallbackScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { client, session, error: authError } = useAuth();
  const url = Linking.useLinkingURL();
  const processedUrl = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client || !url || processedUrl.current === url) return;
    if (processedUrl.current && url === getAuthRedirectUrl()) return;
    processedUrl.current = url;
    const callbackUrl = url;
    const authClient = client;
    async function complete() {
      try {
        const credentials = parseAuthCallback(callbackUrl, getAuthRedirectUrl());
        const { error } = await authClient.auth.setSession({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token,
        });
        if (error) throw new Error('Não foi possível validar sua sessão. Solicite outro link e tente novamente.');
        if (credentials.type === 'recovery') {
          if (Platform.OS === 'web') {
            window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
          }
          setRecovering(true);
          return;
        }
        // Full replacement also drops the callback fragment from the browser history.
        if (Platform.OS === 'web') window.location.replace('/');
        else router.replace('/');
      } catch (cause) {
        if (Platform.OS === 'web') window.location.replace('/login');
        else setError(cause instanceof Error ? cause.message : 'Não foi possível concluir o acesso.');
      }
    }
    void complete();
  }, [client, url]);

  async function savePassword() {
    setError(null);
    if (!password) {
      setError('Informe uma nova senha.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não conferem.');
      return;
    }
    if (!client) {
      setError(authError ?? 'O serviço de autenticação está indisponível.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar sua senha. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (recovering) {
    return <View style={styles.container}>
      <Text style={styles.title}>Defina uma nova senha</Text>
      <Text style={styles.description}>Depois de salvar, você poderá entrar com seu e-mail e senha.</Text>
      <TextInput accessibilityLabel="Nova senha" value={password} onChangeText={setPassword}
        editable={!saving} placeholder="Nova senha" placeholderTextColor={colors.muted}
        secureTextEntry style={styles.input} />
      <TextInput accessibilityLabel="Confirme a nova senha" value={confirmation} onChangeText={setConfirmation}
        editable={!saving} placeholder="Confirme a nova senha" placeholderTextColor={colors.muted}
        secureTextEntry style={styles.input} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void savePassword()}
        style={[styles.button, saving && styles.disabled]}>
        <Text style={styles.link}>{saving ? 'Salvando…' : 'Salvar nova senha'}</Text>
      </Pressable>
    </View>;
  }

  const visibleError = error ?? (!client ? authError : null);
  return <View style={styles.container}>
    <Text style={styles.title}>Confirmando seu acesso</Text>
    {visibleError ? <>
      <Text accessibilityRole="alert" style={styles.error}>{visibleError}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace(session ? '/' : '/login')}>
        <Text style={styles.link}>{session ? 'Ir para meu treino' : 'Voltar para o login'}</Text>
      </Pressable>
    </> : <ActivityIndicator accessibilityLabel="Validando link de acesso" color={colors.primary} />}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 24, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  description: { color: colors.muted, lineHeight: 22 },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
  error: { color: colors.danger, lineHeight: 24 },
  link: { color: colors.primary, paddingVertical: 16 },
  button: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
});
