import { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { useAuth } from './AuthProvider';

type Props = {
  disabled: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
};

export function AccountPanel({ disabled, run }: Props) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { client, session } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;

  function perform(action: () => Promise<void>) {
    setError(null);
    void run(action).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a solicitação.'));
  }

  return (
    <View style={styles.panel}>
      <View style={styles.heading}><View style={styles.avatar}><Feather name="user" size={20} color={colors.secondary} /></View>
        <View><Text style={styles.caption}>NO SEU CONTROLE</Text><Text style={styles.title}>Sua conta</Text></View></View>
      <Text style={styles.text}>{session?.user.email}</Text>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => perform(async () => {
        if (!client) throw new Error('Cliente de autenticação indisponível.');
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      })}><Text style={styles.link}>Sair da conta neste aparelho</Text></Pressable>
      {privacyUrl && <Pressable accessibilityRole="link" onPress={() => {
        void Linking.openURL(privacyUrl).catch(() => setError('Não foi possível abrir a política de privacidade.'));
      }}><Text style={styles.link}>Política de privacidade</Text></Pressable>}
      {!confirming ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setConfirming(true)}>
        <Text style={styles.error}>Excluir minha conta e meus dados</Text>
      </Pressable> : <>
        <Text style={styles.text}>A exclusão é permanente e apaga conta, treinos e arquivos. Digite EXCLUIR para confirmar.</Text>
        <TextInput accessibilityLabel="Digite EXCLUIR para apagar sua conta" value={confirmation}
          onChangeText={setConfirmation} editable={!disabled} autoCapitalize="characters" style={styles.input} />
        <Pressable accessibilityRole="button" disabled={disabled || confirmation !== 'EXCLUIR'} onPress={() => perform(async () => {
          if (!client) throw new Error('Cliente de autenticação indisponível.');
          const { data, error } = await client.functions.invoke('delete-account', { body: {} });
          if (error) throw new Error(`Não foi possível excluir a conta: ${error.message}`);
          if (!data || data.deleted !== true) throw new Error('O servidor não confirmou a exclusão da conta.');
          const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
          if (signOutError) throw new Error(`Conta excluída, mas falhou a limpeza da sessão: ${signOutError.message}`);
        })}><Text style={styles.error}>Confirmar exclusão permanente</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => {
          setConfirming(false); setConfirmation('');
        }}><Text style={styles.link}>Cancelar</Text></Pressable>
      </>}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { gap: 16, padding: 22, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { padding: 12, borderRadius: 14, backgroundColor: colors.elevated },
  caption: { color: colors.muted, fontSize: 9, letterSpacing: 1.5, marginBottom: 5 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  text: { color: colors.muted, lineHeight: 22 },
  link: { color: colors.primary, paddingVertical: 8 },
  error: { color: colors.danger },
  input: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 },
});
