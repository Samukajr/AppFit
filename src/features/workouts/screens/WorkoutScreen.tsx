import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme';
import { ExerciseCard } from '../components/ExerciseCard';
import type { Exercise, WorkoutSet } from '../types';
import { remainingSeconds } from '../utils';

const exercises: Exercise[] = [
  { id: 'squat', name: 'Agachamento livre', targetSets: 3, targetReps: '8–12' },
  { id: 'bench', name: 'Supino reto', targetSets: 3, targetReps: '8–12' },
  { id: 'row', name: 'Remada baixa', targetSets: 3, targetReps: '10–12' },
];

export function WorkoutScreen() {
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [rest, setRest] = useState('60');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (deadline === null) return;
    function update() {
      const remaining = remainingSeconds(deadline, Date.now());
      setSeconds(remaining);
      if (remaining === 0) {
        setDeadline(null);
        setMessage('Descanso concluído. Pronto para a próxima série!');
      }
    }
    update();
    const interval = setInterval(update, 250);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [deadline]);

  function startRest() {
    const duration = Number(rest);
    if (!/^\d+$/.test(rest) || duration < 5 || duration > 600) {
      setMessage('Configure o descanso entre 5 e 600 segundos.');
      return;
    }
    setMessage(null);
    setSeconds(duration);
    setDeadline(Date.now() + duration * 1000);
  }

  const volume = sets.reduce((total, set) => total + set.weightKg * set.reps, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>FITVISION <Text style={styles.accent}>AI</Text></Text>
        <Text style={styles.eyebrow}>SEU PRÓXIMO NÍVEL COMEÇA AQUI</Text>
        <Text style={styles.heading}>Hora de treinar.</Text>
        <Text style={styles.muted}>Treino demonstrativo · Corpo inteiro</Text>
        <View style={styles.summary}>
          <View><Text style={styles.number}>{sets.length}</Text><Text style={styles.muted}>Séries registradas</Text></View>
          <View><Text style={styles.number}>{volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</Text><Text style={styles.muted}>Volume total</Text></View>
        </View>
        <View style={styles.timer}>
          <Text style={styles.title}>Seu descanso</Text>
          <Text accessibilityLiveRegion="polite" style={styles.clock}>
            {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}
          </Text>
          <Text style={styles.muted}>Duração em segundos (5–600)</Text>
          <TextInput accessibilityLabel="Duração do descanso em segundos" value={rest} onChangeText={setRest}
            keyboardType="number-pad" maxLength={3} style={styles.input} />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={startRest} style={styles.button}>
              <Text style={styles.buttonText}>{deadline ? 'Reiniciar' : 'Iniciar descanso'}</Text>
            </Pressable>
            {deadline !== null && <Pressable accessibilityRole="button" style={styles.cancel} onPress={() => {
              setDeadline(null); setSeconds(0); setMessage('Descanso cancelado.');
            }}><Text style={styles.muted}>Cancelar</Text></Pressable>}
          </View>
          {message && <Text accessibilityLiveRegion="polite" style={styles.muted}>{message}</Text>}
        </View>
        <Text style={styles.title}>Exercícios</Text>
        {exercises.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} sets={sets.filter((set) => set.exerciseId === exercise.id)}
            onRegister={(reps, weightKg) => {
              const id = ++nextId.current;
              setSets((current) => [...current, { id, exerciseId: exercise.id, reps, weightKg }]);
            }}
            onRemove={(id) => setSets((current) => current.filter((set) => set.id !== id))} />
        ))}
        <Text style={styles.notice}>Protótipo local: os registros permanecem apenas nesta sessão e são perdidos ao fechar o app. Nenhum dado é enviado ao servidor.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 18, maxWidth: 680, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  brand: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  accent: { color: colors.primary },
  eyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 1.5, marginTop: 14 },
  heading: { color: colors.text, fontSize: 34, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  number: { color: colors.primary, fontWeight: '800', fontSize: 26 },
  timer: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  clock: { color: colors.primary, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  input: { color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  button: { padding: 14, borderRadius: 12, backgroundColor: colors.primary },
  buttonText: { color: colors.background, fontWeight: '700' },
  cancel: { padding: 14 },
  notice: { color: colors.muted, lineHeight: 21, fontSize: 13 },
});
