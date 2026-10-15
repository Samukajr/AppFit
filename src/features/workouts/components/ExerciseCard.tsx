import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../../theme';
import type { Exercise, WorkoutSet } from '../types';
import { parseSet } from '../utils';

type Props = {
  exercise: Exercise;
  sets: WorkoutSet[];
  onRegister: (reps: number, weightKg: number) => void;
  onRemove: (id: number) => void;
};

export function ExerciseCard({ exercise, sets, onRegister, onRemove }: Props) {
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState<string | null>(null);

  function register() {
    try {
      const result = parseSet(reps, weight);
      setError(null);
      onRegister(result.reps, result.weightKg);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a série.');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{exercise.name}</Text>
      <Text style={styles.muted}>{exercise.targetSets} séries · {exercise.targetReps} repetições</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.muted}>Carga (kg)</Text>
          <TextInput accessibilityLabel={`Carga para ${exercise.name}`} value={weight} onChangeText={setWeight}
            keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={styles.input} maxLength={8} />
        </View>
        <View style={styles.field}>
          <Text style={styles.muted}>Repetições</Text>
          <TextInput accessibilityLabel={`Repetições para ${exercise.name}`} value={reps} onChangeText={setReps}
            keyboardType="number-pad" style={styles.input} maxLength={4} />
        </View>
      </View>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" onPress={register} style={styles.button}>
        <Text style={styles.buttonText}>+ Registrar série</Text>
      </Pressable>
      {sets.map((set, index) => (
        <View key={set.id} style={styles.setRow}>
          <Text style={styles.muted}>Série {index + 1} · {set.weightKg} kg × {set.reps}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remover série ${index + 1} de ${exercise.name}`}
            onPress={() => onRemove(set.id)} style={styles.remove}>
            <Text style={styles.error}>Remover</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  input: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 },
  button: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  remove: { paddingVertical: 12, paddingLeft: 12 },
  error: { color: colors.danger },
});
