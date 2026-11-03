import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../../components/Brand';
import { GymBackground } from '../../components/GymBackground';
import { ThemePicker } from '../../components/ThemePicker';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { useAuth } from './AuthProvider';
import { getAuthRedirectUrl } from './redirect';

type FormMode = 'login' | 'signup' | 'recovery';

export function LoginScreen() {
  const { colors, styles } = useThemedStyles(createStyles);
  const { client, error: authError } = useAuth();
  const [mode, setMode] = useState<FormMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function changeMode(next: FormMode) {
    setMode(next);
    setPassword('');
    setConfirmation('');
    setError(null);
    setNotice(null);
  }

  async function submit() {
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Informe seu e-mail.');
      return;
    }
    if (mode !== 'recovery' && !password) {
      setError('Informe sua senha.');
      return;
    }
    if (mode === 'signup' && password !== confirmation) {
      setError('As senhas não conferem.');
      return;
    }
    if (!client) {
      setError(authError ?? 'O serviço de autenticação está indisponível.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
      } else if (mode === 'signup') {
        const { data, error: signUpError } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: getAuthRedirectUrl() },
        });
        if (signUpError) throw signUpError;
        if (!data.user) throw new Error('O servidor não confirmou a criação da conta.');
        if (!data.session) {
          setNotice('Conta criada. Se a confirmação estiver ativada, confira seu e-mail uma vez para liberar o primeiro acesso.');
        }
      } else {
        const { error: recoveryError } = await client.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: getAuthRedirectUrl(),
        });
        if (recoveryError) throw recoveryError;
        setNotice('Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a solicitação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'login' ? 'Entre na sua conta' : mode === 'signup' ? 'Crie sua conta' : 'Recupere sua senha';
  const description = mode === 'login'
    ? 'Acesse seus treinos com e-mail e senha.'
    : mode === 'signup'
      ? 'Cadastre-se para acompanhar sua evolução.'
      : 'Vamos enviar um link apenas para redefinir sua senha.';
  const actionLabel = mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link de recuperação';

  return (
    <GymBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <ThemePicker />
              <View style={styles.card}>
                <Brand />
                <View style={styles.intro}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.description}>{description}</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    accessibilityLabel="E-mail"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    onSubmitEditing={() => {
                      if (mode === 'recovery') void submit();
                    }}
                    placeholder="voce@exemplo.com"
                    placeholderTextColor={colors.muted}
                    returnKeyType={mode === 'recovery' ? 'send' : 'next'}
                    style={styles.input}
                    value={email}
                  />
                </View>

                {mode !== 'recovery' && <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Senha</Text>
                    <TextInput
                      accessibilityLabel="Senha"
                      editable={!busy}
                      onChangeText={setPassword}
                      onSubmitEditing={() => {
                        if (mode === 'login') void submit();
                      }}
                      placeholder="Sua senha"
                      placeholderTextColor={colors.muted}
                      returnKeyType={mode === 'signup' ? 'next' : 'go'}
                      secureTextEntry
                      style={styles.input}
                      value={password}
                    />
                  </View>
                  {mode === 'signup' && <View style={styles.field}>
                    <Text style={styles.label}>Confirme a senha</Text>
                    <TextInput
                      accessibilityLabel="Confirme a senha"
                      editable={!busy}
                      onChangeText={setConfirmation}
                      onSubmitEditing={() => void submit()}
                      placeholder="Digite a senha novamente"
                      placeholderTextColor={colors.muted}
                      returnKeyType="go"
                      secureTextEntry
                      style={styles.input}
                      value={confirmation}
                    />
                  </View>}
                </>}

                {(!client && authError) && <Text accessibilityRole="alert" style={styles.error}>{authError}</Text>}
                {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                {notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || !client }}
                  disabled={busy || !client}
                  onPress={() => void submit()}
                  style={[styles.primaryButton, (busy || !client) && styles.disabledButton]}>
                  <Text style={styles.primaryButtonText}>{busy ? 'Aguarde…' : actionLabel}</Text>
                </Pressable>

                <View style={styles.links}>
                  {mode === 'login' && <>
                    <Text style={styles.helper}>Ainda não tem conta?</Text>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('signup')}>
                      <Text style={styles.link}>Criar conta</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('recovery')}>
                      <Text style={styles.link}>Esqueci minha senha</Text>
                    </Pressable>
                  </>}
                  {mode === 'signup' && <>
                    <Text style={styles.helper}>Já tem uma conta?</Text>
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('login')}>
                      <Text style={styles.link}>Entrar</Text>
                    </Pressable>
                  </>}
                  {mode === 'recovery' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => changeMode('login')}>
                    <Text style={styles.link}>Voltar para entrar</Text>
                  </Pressable>}
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GymBackground>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 18 },
  card: { gap: 22, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  intro: { gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  field: { gap: 8 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 50, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text },
  error: { color: colors.danger, lineHeight: 20 },
  notice: { color: colors.secondary, lineHeight: 20 },
  primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  links: { alignItems: 'center', gap: 8 },
  helper: { color: colors.muted, fontSize: 13 },
  link: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 10, color: colors.primary, fontWeight: '700', textAlign: 'center' },
});
