import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedStyles, type ThemeColors } from '../../../theme';
import type { ExerciseDemonstration } from '../types';
import { youtubeExerciseSearch } from '../video';

type Props = { exerciseName: string; demonstration?: ExerciseDemonstration };

export function ExerciseDemoLink({ exerciseName, demonstration }: Props) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    try { await Linking.openURL(demonstration?.url ?? youtubeExerciseSearch(exerciseName)); }
    catch { setError('Não foi possível abrir o vídeo. Verifique se o navegador ou aplicativo está disponível.'); }
  }

  return <View style={styles.container}>
    <Pressable accessibilityRole="link" accessibilityLabel={`${demonstration ? 'Ver demonstração de execução' : 'Buscar execução no YouTube'}: ${exerciseName}`}
      accessibilityHint={demonstration
        ? `Abre um vídeo do ${demonstration.provider === 'youtube' ? 'YouTube' : 'Vimeo'} fora do aplicativo`
        : 'Abre uma busca externa; os resultados não foram revisados pelo aplicativo'}
      onPress={() => void open()} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Feather name="play-circle" size={18} color={colors.primary} />
      <Text style={styles.linkText}>{demonstration ? 'Ver demonstração' : 'Buscar execução no YouTube'}</Text>
      <Feather name="external-link" size={14} color={colors.secondary} />
    </Pressable>
    <Text style={styles.credit}>{demonstration
      ? `Vídeo: ${demonstration.credit} · ${demonstration.license}`
      : 'Busca externa, não um vídeo aprovado. Confira a execução com um profissional. O nome do exercício será enviado ao YouTube ao abrir.'}</Text>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { gap: 5, alignItems: 'flex-start' },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingRight: 12 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  credit: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
