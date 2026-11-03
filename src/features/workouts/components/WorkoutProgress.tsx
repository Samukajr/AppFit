import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../../../theme';
import type { createWorkoutRepository } from '../repository';
import { weeklyFrequency, type ProgressSession } from '../progress';

type Props = { repository: Pick<ReturnType<typeof createWorkoutRepository>, 'progress'>; revision: string };
const periods = [{ days: 30, label: '30 dias' }, { days: 90, label: '90 dias' }, { days: null, label: 'Todo o histórico' }] as const;
const dayLabel = (date: string) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function WorkoutProgress({ repository, revision }: Props) {
  const { styles } = useThemedStyles(createStyles);
  const [days, setDays] = useState<30 | 90 | null>(30);
  const [result, setResult] = useState<{ key: string; sessions: ProgressSession[]; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0);
  const [workoutId, setWorkoutId] = useState('');
  const [exerciseKey, setExerciseKey] = useState('');
  const [detail, setDetail] = useState<string | null>(null);
  const requestKey = `${days}:${revision}:${retry}`;
  const loading = result?.key !== requestKey;
  const sessions = !loading && result ? result.sessions : [];
  const error = !loading ? result?.error : null;

  useEffect(() => {
    let active = true;
    void repository.progress(days).then((data) => {
      if (active) setResult({ key: requestKey, sessions: data, error: null });
    }).catch((cause: unknown) => {
      if (active) setResult({ key: requestKey, sessions: [], error: cause instanceof Error ? cause.message : 'Não foi possível carregar sua evolução.' });
    });
    return () => { active = false; };
  }, [repository, days, requestKey]);

  const workouts = [...new Map(sessions.map((session) => [session.workoutId, session.workoutName])).entries()];
  const selectedWorkout = workouts.some(([id]) => id === workoutId) ? workoutId : '';
  const filtered = sessions.filter((session) => !selectedWorkout || session.workoutId === selectedWorkout);
  const exercises = [...new Map(filtered.flatMap((session) => session.lifts.map((lift) => [lift.exerciseKey, lift.name] as const))).entries()];
  const selectedExercise = exercises.some(([key]) => key === exerciseKey) ? exerciseKey : exercises[0]?.[0];
  const points = filtered.flatMap((session) => {
    const lift = session.lifts.find((lift) => lift.exerciseKey === selectedExercise);
    return lift ? [{ ...lift, session }] : [];
  });
  const weeks = weeklyFrequency(filtered, days);
  const maxWeight = points.reduce((max, point) => Math.max(max, point.weightKg), 1);
  const maxCount = weeks.reduce((max, week) => Math.max(max, week.count), 1);

  return <View style={styles.panel}>
    <Text style={styles.title}>Minha evolução</Text>
    <Text style={styles.text}>Somente treinos concluídos com registros, incluindo fichas arquivadas. Aumentar a carga não garante melhor execução; respeite a orientação profissional.</Text>
    <View style={styles.row}>{periods.map((period) => <Pressable key={period.label} accessibilityRole="button"
      accessibilityState={{ selected: days === period.days }} onPress={() => { setDays(period.days); setDetail(null); }}
      style={[styles.chip, days === period.days && styles.selected]}><Text style={styles.link}>{period.label}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" disabled={loading} onPress={() => { setRetry((value) => value + 1); setDetail(null); }} style={styles.chip}>
      <Text style={styles.link}>Atualizar evolução</Text>
    </Pressable>
    {loading ? <ActivityIndicator accessibilityLabel="Carregando evolução" /> : error ? <>
      <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => { setRetry((value) => value + 1); setDetail(null); }} style={styles.chip}><Text style={styles.link}>Tentar carregar evolução novamente</Text></Pressable>
    </> : <>
      <ScrollView horizontal contentContainerStyle={styles.row}>
        {[['', 'Todas as fichas'], ...workouts].map(([id, name]) => <Pressable key={id} accessibilityRole="button"
          accessibilityLabel={`Evolução: ${name}`} accessibilityState={{ selected: selectedWorkout === id }}
          onPress={() => { setWorkoutId(id); setDetail(null); }} style={[styles.chip, selectedWorkout === id && styles.selected]}>
          <Text style={styles.link}>{name}</Text></Pressable>)}
      </ScrollView>
      {filtered.length === 0 && <Text style={styles.text}>Conclua um treino com séries ou cardio para começar. Não há registros neste período.</Text>}
      <Text style={styles.subtitle}>Frequência semanal</Text>
      <Text style={styles.text}>Treinos concluídos por semana, de segunda a domingo, no horário deste aparelho. As semanas nas bordas do período podem estar incompletas. Escala: 0 a {maxCount} treinos.</Text>
      <ScrollView horizontal contentContainerStyle={styles.chart}>
        {weeks.map((week) => <Pressable key={week.date} accessibilityRole="button"
          accessibilityLabel={`Semana de ${dayLabel(week.date)}: ${week.count} treinos`}
          onPress={() => setDetail(`Semana de ${dayLabel(week.date)}: ${week.count} treino(s) concluído(s).`)} style={styles.column}>
          <Text style={styles.value}>{week.count}</Text>
          <View style={styles.track}><View style={[styles.bar, { height: `${week.count / maxCount * 100}%` }]} /></View>
          <Text style={styles.caption}>{dayLabel(week.date)}</Text>
        </Pressable>)}
      </ScrollView>
      <Text style={styles.subtitle}>Carga por exercício</Text>
      <Text style={styles.text}>Maior carga registrada em uma série de cada sessão, com suas repetições. Em caso de empate de carga, mostramos a série com mais repetições. Escala começa em 0 kg; toque nas barras para detalhes.</Text>
      <ScrollView horizontal contentContainerStyle={styles.row}>{exercises.map(([key, name]) =>
        <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Evolução do exercício ${name}`}
          accessibilityState={{ selected: selectedExercise === key }} onPress={() => { setExerciseKey(key); setDetail(null); }}
          style={[styles.chip, selectedExercise === key && styles.selected]}><Text style={styles.link}>{name}</Text></Pressable>)}</ScrollView>
      {points.length < 2 && <Text style={styles.text}>{points.length === 0
        ? 'Ainda não há séries de força concluídas neste filtro. Treinos apenas de cardio aparecem na frequência.'
        : 'Primeiro registro disponível. Conclua outra sessão deste exercício para comparar a evolução.'}</Text>}
      {points.length > 0 && <ScrollView horizontal contentContainerStyle={styles.chart}>
        {points.map((point) => {
          const label = `${dayLabel(point.session.finishedAt)} · ${point.session.workoutName}: ${point.weightKg.toLocaleString('pt-BR')} kg × ${point.reps} repetições`;
          return <Pressable key={point.session.id} accessibilityRole="button" accessibilityLabel={label}
            onPress={() => setDetail(label)} style={styles.column}>
            <Text style={styles.value}>{point.weightKg.toLocaleString('pt-BR')} kg</Text>
            <View style={styles.track}><View style={[styles.bar, { height: `${point.weightKg / maxWeight * 100}%` }]} /></View>
            <Text style={styles.caption}>{dayLabel(point.session.finishedAt)}</Text>
            <Text style={styles.caption}>{point.reps} rep.</Text>
          </Pressable>;
        })}
      </ScrollView>}
      {detail && <Text accessibilityLiveRegion="polite" style={styles.text}>{detail}</Text>}
      <Text style={styles.caption}>0 kg significa carga registrada como zero, não ausência de treino. As barras seguem a ordem das sessões; não representam intervalos iguais entre datas.</Text>
    </>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { padding: 20, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  text: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  caption: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 16, minHeight: 44, justifyContent: 'center' },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  link: { color: colors.secondary, fontSize: 13 },
  chart: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  column: { width: 88, gap: 6, alignItems: 'center', padding: 4 },
  track: { height: 120, width: 32, justifyContent: 'flex-end', backgroundColor: colors.elevated, borderBottomWidth: 1, borderColor: colors.border },
  bar: { backgroundColor: colors.primary, width: '100%' },
  value: { color: colors.text, fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, lineHeight: 21 },
});
