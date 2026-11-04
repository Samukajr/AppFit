import { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../../../theme';
import { ExerciseDemoLink } from './ExerciseDemoLink';
import type { Exercise, WorkoutSet } from '../types';
import { parseSet } from '../utils';

type Props = {
  exercise: Exercise;
  sets: WorkoutSet[];
  disabled: boolean;
  position: number;
  onRegister: (reps: number, weightKg: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

export function ExerciseCard({ exercise, sets, disabled, position, onRegister, onRemove }: Props) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [reps, setReps] = useState(exercise.targetReps);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function register() {
    try {
      const result = parseSet(reps, weight);
      setError(null);
      await onRegister(result.reps, result.weightKg);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a série.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.index}><Text style={styles.indexText}>{String(position).padStart(2, '0')}</Text></View>
        <View style={styles.name}><Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.muted}>{exercise.targetSets} séries · {exercise.targetReps} repetições</Text></View>
        {sets.length >= exercise.targetSets && <Feather accessibilityLabel="Meta de séries atingida" name="check-circle" size={20} color={colors.primary} />}
      </View>
      <ExerciseDemoLink exerciseName={exercise.name} demonstration={exercise.demonstration} />
      <View style={styles.progressRow}>
        {Array.from({ length: Math.min(exercise.targetSets, 10) }, (_, index) =>
          <View key={index} style={[styles.progressSegment, index < sets.length && styles.progressDone]} />)}
      </View>
      <Text style={styles.caption}>{sets.length} de {exercise.targetSets} séries registradas</Text>
      {exercise.restSeconds !== undefined && <Text style={styles.caption}>Descanso definido na ficha: {exercise.restSeconds} s</Text>}
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>CARGA / KG</Text>
          <TextInput accessibilityLabel={`Carga para ${exercise.name}`} value={weight} onChangeText={setWeight}
            editable={!disabled} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={styles.input} maxLength={8} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>REPETIÇÕES</Text>
          <TextInput accessibilityLabel={`Repetições para ${exercise.name}`} value={reps} onChangeText={setReps}
            editable={!disabled} keyboardType="number-pad" style={styles.input} maxLength={4} />
        </View>
      </View>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Registrar série de ${exercise.name}`} disabled={disabled} onPress={() => void register()} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
        <Feather name="plus" size={18} color={colors.primary} /><Text style={styles.buttonText}>Registrar série</Text>
      </Pressable>
      {sets.map((set, index) => (
        <View key={set.id} style={styles.setRow}>
          <View style={styles.saved}><Feather name="check" size={14} color={colors.primary} /><Text style={styles.muted}>Série {index + 1} · {set.weightKg} kg × {set.reps}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remover série ${index + 1} de ${exercise.name}`}
            disabled={disabled} onPress={() => {
              setError(null);
              void onRemove(set.id).catch((cause: unknown) =>
                setError(cause instanceof Error ? cause.message : 'Não foi possível remover a série.'));
            }} style={styles.remove}>
            <Text style={styles.error}>Remover</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 16 },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  index: { width: 42, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.elevated },
  indexText: { color: colors.secondary, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  name: { flex: 1, gap: 5 },
  progressRow: { flexDirection: 'row', gap: 5 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressDone: { backgroundColor: colors.primary },
  caption: { color: colors.muted, fontSize: 11, marginTop: -8 },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 8 },
  label: { color: colors.muted, fontSize: 10, letterSpacing: 1.4, fontWeight: '700' },
  input: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 54, fontSize: 22, fontWeight: '700' },
  button: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, padding: 15, minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.75 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  remove: { paddingVertical: 14, paddingLeft: 12, minHeight: 48, justifyContent: 'center' },
  error: { color: colors.danger },
  disabled: { opacity: 0.5 },
});
