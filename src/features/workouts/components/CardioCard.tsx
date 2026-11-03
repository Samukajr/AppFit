import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedStyles, type ThemeColors } from '../../../theme';
import { ExerciseDemoLink } from './ExerciseDemoLink';
import type { CardioLog, Exercise } from '../types';
import { parseCardio } from '../utils';

type Props = {
  exercise: Exercise;
  logs: CardioLog[];
  position: number;
  disabled: boolean;
  onRegister: (durationMinutes: number, distanceKm: number | null, perceivedExertion: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

export function CardioCard({ exercise, logs, position, disabled, onRegister, onRemove }: Props) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [minutes, setMinutes] = useState('');
  const [distance, setDistance] = useState('');
  const [exertion, setExertion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const total = logs.reduce((sum, log) => sum + log.durationMinutes, 0);

  async function register() {
    setError(null);
    try {
      const entry = parseCardio(minutes, distance, exertion);
      await onRegister(entry.durationMinutes, entry.distanceKm, entry.perceivedExertion);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o cardio.'); }
  }

  return <View style={styles.card}>
    <View style={styles.row}><View style={styles.icon}><Feather name="activity" size={22} color={colors.secondary} /></View>
      <View style={styles.grow}><Text style={styles.title}>{String(position).padStart(2, '0')} · {exercise.name}</Text>
        <Text style={styles.text}>Meta definida na ficha: {exercise.targetMinutes} min · Registrados: {total} min</Text></View></View>
    {exercise.demonstration && <ExerciseDemoLink exerciseName={exercise.name} demonstration={exercise.demonstration} />}
    <Text style={styles.text}>Registre o que realizou. Cardio não exige carga ou repetições.</Text>
    <View style={styles.fields}>
      <View style={styles.field}><Text style={styles.label}>Minutos (1–600)</Text><TextInput accessibilityLabel={`Minutos de ${exercise.name}`} value={minutes} onChangeText={setMinutes} editable={!disabled} keyboardType="number-pad" maxLength={3} style={styles.input} /></View>
      <View style={styles.field}><Text style={styles.label}>Distância / km (opcional)</Text><TextInput accessibilityLabel={`Distância de ${exercise.name} em km`} value={distance} onChangeText={setDistance} editable={!disabled} keyboardType="decimal-pad" maxLength={7} style={styles.input} /></View>
      <View style={styles.field}><Text style={styles.label}>Esforço percebido (1–10)</Text><TextInput accessibilityLabel={`Esforço percebido em ${exercise.name}`} value={exertion} onChangeText={setExertion} editable={!disabled} keyboardType="number-pad" maxLength={2} style={styles.input} /></View>
    </View>
    <Text style={styles.text}>Esforço percebido: 1 = muito leve; 10 = máximo percebido. É um registro, não uma intensidade recomendada.</Text>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={`Registrar cardio de ${exercise.name}`} disabled={disabled} onPress={() => void register()} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>Registrar cardio</Text></Pressable>
    {logs.map((log, index) => <View key={log.id} style={styles.log}>
      <Text style={[styles.text, styles.grow]}>{log.durationMinutes} min{log.distanceKm === null ? '' : ` · ${log.distanceKm} km`} · Esforço {log.perceivedExertion}/10</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remover registro de cardio ${index + 1} de ${exercise.name}`} disabled={disabled} style={styles.remove} onPress={() => {
        setError(null);
        void onRemove(log.id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Não foi possível remover o cardio.'));
      }}><Text style={styles.error}>Remover</Text></Pressable>
    </View>)}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 22, padding: 22, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { padding: 12, borderRadius: 12, backgroundColor: colors.elevated },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 25 },
  text: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { flexGrow: 1, flexBasis: 120, gap: 8 },
  label: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  input: { color: colors.text, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 12, padding: 12, minHeight: 50, fontSize: 20 },
  button: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 12, padding: 16, minHeight: 50, alignItems: 'center' },
  buttonText: { color: colors.primary, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  log: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  remove: { paddingVertical: 14, minHeight: 48 },
  error: { color: colors.danger, lineHeight: 22 },
});
