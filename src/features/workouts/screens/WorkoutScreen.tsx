import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles, type ThemeColors } from '../../../theme';
import { useAuth } from '../../auth/AuthProvider';
import { AccountPanel } from '../../auth/AccountPanel';
import { ExerciseCard } from '../components/ExerciseCard';
import { CardioCard } from '../components/CardioCard';
import { WorkoutLibrary } from '../components/WorkoutLibrary';
import { WorkoutProgress } from '../components/WorkoutProgress';
import { createWorkoutRepository } from '../repository';
import type { WorkoutSnapshot } from '../types';
import { remainingSeconds, workoutProgress } from '../utils';
import { Brand } from '../../../components/Brand';
import { ThemePicker } from '../../../components/ThemePicker';
import { GymBackground } from '../../../components/GymBackground';
import { AssessmentPanel } from '../../assessments/AssessmentPanel';
import { AssistantPanel } from '../../assistant/AssistantPanel';

export function WorkoutScreen({ initialWorkoutId }: { initialWorkoutId?: string } = {}) {
  const { colors, styles } = useThemedStyles(createStyles);
  const { client } = useAuth();
  const repository = useMemo(() => client ? createWorkoutRepository(client) : null, [client]);
  const [snapshot, setSnapshot] = useState<WorkoutSnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [rest, setRest] = useState('60');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [startCreating, setStartCreating] = useState(false);
  const [assessmentsOpen, setAssessmentsOpen] = useState(false);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const selectedWorkout = useRef<string | undefined>(initialWorkoutId);
  const pending = useRef(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (pending.current) throw new Error('Aguarde a operação atual.');
    pending.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      await run(async () => {
        if (!repository) throw new Error('Entre novamente para carregar o treino.');
        const data = await repository.load(selectedWorkout.current);
        if (mounted.current) {
          setSnapshot(data);
          setNeedsReload(false);
        }
      });
    } catch (cause) {
      if (mounted.current) {
        setNeedsReload(true);
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar seu treino.');
      }
    }
  }, [repository, run]);

  async function selectWorkout(id: string) {
    setError(null);
    await run(async () => {
      if (!repository) throw new Error('Sessão indisponível.');
      const data = await repository.load(id);
      if (mounted.current) {
        selectedWorkout.current = id;
        setSnapshot(data); setNeedsReload(false); setLibraryOpen(false);
        setDeadline(null); setSeconds(0); setMessage(null);
      }
    });
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (!repository) throw new Error('Entre novamente para carregar o treino.');
      const data = await repository.load(selectedWorkout.current);
      if (active) { setSnapshot(data); setNeedsReload(false); }
    }
    void initialize().catch((cause: unknown) => {
      if (active) {
        setNeedsReload(true);
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar seu treino.');
      }
    }).finally(() => {
      if (active) { pending.current = false; setBusy(false); }
    });
    return () => { active = false; };
  }, [repository]);

  async function mutate(action: () => Promise<void>) {
    if (needsReload) throw new Error('Atualize o treino antes de continuar.');
    try {
      await run(action);
    } catch (cause) {
      if (mounted.current) {
        setNeedsReload(true);
        setError('A alteração não foi confirmada. Atualize o treino para conferir o estado salvo antes de tentar novamente.');
      }
      throw cause;
    }
  }

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

  const sets = snapshot?.sets ?? [];
  const cardio = snapshot?.cardio ?? [];
  const cardioMinutes = cardio.reduce((total, log) => total + log.durationMinutes, 0);
  const volume = sets.reduce((total, set) => total + set.weightKg * set.reps, 0);
  const targetSets = snapshot?.exercises.reduce((total, exercise) => total + (exercise.kind === 'cardio' ? 0 : exercise.targetSets), 0) ?? 0;
  const progress = workoutProgress(snapshot?.exercises ?? [], sets);

  return (
    <GymBackground><SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><Brand /><View style={styles.sessionBadge}><View style={styles.statusDot} /><Text style={styles.sessionText}>{snapshot ? 'SESSÃO ATIVA' : 'PREPARANDO SESSÃO'}</Text></View></View>
        <ThemePicker />
        <Pressable accessibilityRole="button" disabled={assessmentBusy} style={[styles.button, assessmentBusy && styles.disabled]} onPress={() => setAssessmentsOpen(!assessmentsOpen)}>
          <Text style={styles.buttonText}>{assessmentsOpen ? 'Fechar avaliações (descartar rascunho)' : 'Minhas avaliações e anamnese'}</Text>
        </Pressable>
        {assessmentsOpen && <AssessmentPanel onBusyChange={setAssessmentBusy} onPlanSaved={selectWorkout} disabled={busy} />}
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={() => setAssistantOpen(!assistantOpen)}>
          <Text style={styles.buttonText}>{assistantOpen ? 'Fechar guia local' : 'Ajuda local para treino e exercícios'}</Text>
        </Pressable>
        {assistantOpen && <AssistantPanel onOpenLibrary={() => {
          setAssistantOpen(false);
          setStartCreating(false);
          setLibraryOpen(true);
        }} />}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>FOCO NO QUE TE MOVE</Text>
          <Text style={styles.heading}>Sua melhor versão.{'\n'}<Text style={styles.accent}>Uma série de cada vez.</Text></Text>
          <View style={styles.heroBottom}>
            <View style={styles.heroDescription}><Text style={styles.workoutName}>{snapshot?.workout.isStarter ? 'Monte sua primeira ficha' : snapshot?.workout.name ?? 'Carregando sua ficha…'}</Text>
              <Text style={styles.notice}>{snapshot?.workout.isStarter ? 'Escolha os exercícios na biblioteca e salve sua ficha.' : 'Sua ficha manual · Não é uma prescrição automática'}</Text></View>
            {snapshot && !snapshot.workout.isStarter && <View style={styles.progressBadge}><Feather name="activity" size={16} color={colors.primary} /><Text style={styles.progressText}>{targetSets > 0 ? `${progress}% da meta de séries` : `${cardioMinutes} min de cardio registrados`}</Text></View>}
          </View>
          {targetSets > 0 && <View accessibilityRole="progressbar" accessibilityLabel="Meta de séries do treino" accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>}
        </View>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {busy && <ActivityIndicator accessibilityLabel="Sincronizando treino" color={colors.primary} />}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setStartCreating(false); setLibraryOpen(!libraryOpen); }}
          style={[styles.button, busy && styles.disabled]}>
          <Text style={styles.buttonText}>{libraryOpen ? 'Voltar ao treino (descartar rascunho)' : 'Minhas fichas e biblioteca de exercícios'}</Text>
        </Pressable>
        {libraryOpen && repository && <WorkoutLibrary repository={repository} disabled={busy}
          key={startCreating ? 'create' : 'browse'} startCreating={startCreating}
          activeId={snapshot?.workout.id} onSelect={selectWorkout} onClose={() => setLibraryOpen(false)} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Atualizar dados salvos" disabled={busy} onPress={() => void load()} style={({ pressed }) => [styles.sync, pressed && styles.disabled, busy && styles.disabled]}>
          <Feather name="refresh-cw" size={14} color={colors.secondary} /><Text style={styles.syncText}>Atualizar dados salvos</Text>
        </Pressable>
        {snapshot && <>
        <View style={styles.summary}>
          {targetSets > 0 && <><View style={styles.stat}><Feather name="layers" size={18} color={colors.secondary} /><Text style={styles.number}>{sets.length}<Text style={styles.statUnit}> / {targetSets}</Text></Text><Text style={styles.statLabel}>Séries registradas</Text></View>
          <View style={styles.stat}><Feather name="trending-up" size={18} color={colors.primary} /><Text style={styles.number}>{volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}<Text style={styles.statUnit}> kg</Text></Text><Text style={styles.statLabel}>Volume da sessão</Text></View></>}
          {snapshot.exercises.some((exercise) => exercise.kind === 'cardio') && <View style={styles.stat}><Feather name="activity" size={18} color={colors.secondary} /><Text style={styles.number}>{cardioMinutes}<Text style={styles.statUnit}> min</Text></Text><Text style={styles.statLabel}>Cardio registrado</Text></View>}
        </View>
        {snapshot.exercises.length > 0 && <View style={styles.timer}>
          <View style={styles.sectionHeader}><View style={styles.inline}><Feather name="clock" size={18} color={colors.secondary} /><Text style={styles.title}>Recarregue o ritmo</Text></View><Text style={styles.smallLabel}>{deadline ? 'EM ANDAMENTO' : 'DESCANSO'}</Text></View>
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
        </View>}
        {snapshot.exercises.length === 0 ? <View style={styles.emptyWorkout}>
          <Feather name="clipboard" size={28} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Sua ficha ainda não tem exercícios</Text>
          <Text style={styles.notice}>Escolha os exercícios e as metas para montar sua própria ficha. Eles aparecerão aqui depois que você salvar.</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setStartCreating(true); setLibraryOpen(true); }}
            style={[styles.button, busy && styles.disabled]}>
            <Text style={styles.buttonText}>Montar minha ficha</Text>
          </Pressable>
        </View> : <>
        <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>SEU PLANO EM MOVIMENTO</Text><Text style={styles.title}>Exercícios</Text></View><Text style={styles.smallLabel}>{snapshot.exercises.length} NA FICHA</Text></View>
        {snapshot.exercises.map((exercise, index) => exercise.kind === 'cardio' ? (
          <CardioCard key={`${snapshot.session.id}-${exercise.id}`} exercise={exercise} position={index + 1}
            logs={cardio.filter((log) => log.exerciseId === exercise.id)} disabled={busy || needsReload}
            onRegister={async (durationMinutes, distanceKm, perceivedExertion) => {
              if (!repository) throw new Error('Sessão indisponível.');
              await mutate(async () => {
                const saved = await repository.registerCardio(snapshot.session.id, exercise.id, durationMinutes, distanceKm, perceivedExertion);
                if (mounted.current) setSnapshot((current) => current ? { ...current, cardio: [...(current.cardio ?? []), saved] } : current);
              });
            }}
            onRemove={async (id) => {
              if (!repository) throw new Error('Sessão indisponível.');
              await mutate(async () => {
                await repository.removeCardio(snapshot.session.id, id);
                if (mounted.current) setSnapshot((current) => current ? { ...current, cardio: current.cardio?.filter((log) => log.id !== id) } : current);
              });
            }} />
        ) : (
          <ExerciseCard key={`${snapshot.session.id}-${exercise.id}`} position={index + 1} exercise={exercise} sets={sets.filter((set) => set.exerciseId === exercise.id)}
            disabled={busy || needsReload}
            onRegister={async (reps, weightKg) => {
              if (!repository) throw new Error('Sessão indisponível.');
              const duration = Number(rest);
              if (!/^\d+$/.test(rest) || duration < 5 || duration > 600) throw new Error('Configure o descanso entre 5 e 600 segundos.');
              await mutate(async () => {
                const saved = await repository.register(snapshot.session.id, exercise.id, reps, weightKg, duration);
                if (mounted.current) setSnapshot((current) => current ? { ...current, sets: [...current.sets, saved] } : current);
              });
            }}
            onRemove={async (id) => {
              if (!repository) throw new Error('Sessão indisponível.');
              await mutate(async () => {
                await repository.remove(snapshot.session.id, id);
                if (mounted.current) setSnapshot((current) => current ? { ...current, sets: current.sets.filter((set) => set.id !== id) } : current);
              });
            }} />
        ))}
        </>}
        <Pressable accessibilityRole="button" disabled={busy || needsReload || (sets.length === 0 && cardio.length === 0)} style={({ pressed }) => [styles.button, styles.finish, pressed && styles.disabled, (busy || needsReload || (sets.length === 0 && cardio.length === 0)) && styles.disabled]} onPress={() => {
          void mutate(async () => {
            if (!repository) throw new Error('Sessão indisponível.');
            await repository.finish(snapshot.session.id);
            if (mounted.current) {
              setDeadline(null); setSeconds(0);
            }
            const next = await repository.load(selectedWorkout.current);
            if (mounted.current) { setSnapshot(next); setMessage('Treino concluído e salvo no histórico. Nova sessão pronta.'); }
          }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Não foi possível concluir o treino.'));
        }}><Feather name="check-circle" size={18} color={colors.onPrimary} /><Text style={styles.buttonText}>Concluir treino e iniciar nova sessão</Text></Pressable>
        <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>CADA TREINO CONTA</Text><Text style={styles.title}>Seu histórico</Text></View><Feather name="bar-chart-2" size={22} color={colors.secondary} /></View>
        <Text style={styles.notice}>Últimos 10 treinos concluídos</Text>
        {snapshot.history.length === 0 && <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="flag" size={24} color={colors.secondary} /></View><Text style={styles.title}>Seu ponto de partida.</Text><Text style={styles.muted}>Conclua seu primeiro treino para começar a construir seu histórico.</Text></View>}
        {snapshot.history.map((entry) => <View key={entry.id} style={styles.timer}>
          <Text style={styles.muted}>{new Date(entry.finishedAt).toLocaleString('pt-BR')}</Text>
          <Text style={styles.muted}>{entry.setCount} séries · {entry.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg de volume</Text>
          {entry.cardioMinutes !== undefined && entry.cardioMinutes > 0 && <Text style={styles.muted}>{entry.cardioMinutes} min de cardio</Text>}
        </View>)}
        {repository && <WorkoutProgress repository={repository} revision={snapshot.session.id} />}
        </>}
        <View style={styles.info}><Feather name="shield" size={18} color={colors.secondary} /><Text style={[styles.notice, styles.infoText]}>Cada série é confirmada pelo servidor antes de aparecer aqui. Internet necessária para salvar. O descanso é local e não envia notificações.</Text></View>
        <AccountPanel disabled={busy || assessmentBusy} run={run} />
      </ScrollView>
    </SafeAreaView></GymBackground>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1 },
  hero: { padding: 24, gap: 20, borderRadius: 26, backgroundColor: colors.hero, borderWidth: 1, borderColor: colors.primaryBorder },
  content: { padding: 20, gap: 20, maxWidth: 820, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingVertical: 12 },
  sessionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  sessionText: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  heroBottom: { flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  heroDescription: { gap: 6 },
  workoutName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  progressBadge: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  progressText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 5, backgroundColor: colors.progressTrack, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: colors.primary, borderRadius: 3 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 8 },
  syncText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  accent: { color: colors.primary },
  eyebrow: { color: colors.primary, fontSize: 9, letterSpacing: 1.8, fontWeight: '700', marginBottom: 8 },
  heading: { color: colors.text, fontSize: 32, lineHeight: 39, letterSpacing: -1, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 14 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 130, padding: 18, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: 12 },
  number: { color: colors.text, fontWeight: '800', fontSize: 27, fontVariant: ['tabular-nums'] },
  statUnit: { color: colors.muted, fontWeight: '500', fontSize: 14 },
  statLabel: { color: colors.muted, fontSize: 11 },
  timer: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, gap: 16 },
  emptyWorkout: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 24, alignItems: 'center', gap: 14 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  smallLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  clock: { color: colors.text, fontSize: 64, fontWeight: '800', letterSpacing: -2, textAlign: 'center', paddingVertical: 10, fontVariant: ['tabular-nums'] },
  input: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  button: { padding: 16, minHeight: 50, borderRadius: 14, backgroundColor: colors.primary },
  finish: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10 },
  buttonText: { color: colors.onPrimary, fontWeight: '700' },
  cancel: { padding: 14 },
  notice: { color: colors.muted, lineHeight: 21, fontSize: 13 },
  error: { color: colors.danger, lineHeight: 21 },
  disabled: { opacity: 0.45 },
  empty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 22, padding: 28, alignItems: 'center', gap: 14 },
  emptyIcon: { padding: 14, borderRadius: 16, backgroundColor: colors.elevated },
  info: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  infoText: { flex: 1 },
});
