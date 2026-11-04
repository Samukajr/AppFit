import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../../components/Brand';
import { GymBackground } from '../../components/GymBackground';
import { ThemePicker } from '../../components/ThemePicker';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { AssessmentPanel } from '../assessments/AssessmentPanel';
import { useAuth } from '../auth/AuthProvider';
import { WorkoutScreen } from '../workouts/screens/WorkoutScreen';
import { createOnboardingRepository, type OnboardingStatus } from './repository';

export function StudentHome() {
  const { client } = useAuth();
  const { colors, styles } = useThemedStyles(createStyles);
  const repository = useMemo(() => client ? createOnboardingRepository(client) : null, [client]);
  const [loading, setLoading] = useState(true);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [workoutId, setWorkoutId] = useState<string>();
  const pending = useRef(false);
  const [manualAccess, setManualAccess] = useState(false);

  async function load() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      if (!repository) throw new Error('Entre novamente para carregar sua apresentação.');
      setStatus(await repository.load());
      setOnboardingLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua apresentação.');
    } finally { pending.current = false; setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    async function initialize() {
      if (!repository) throw new Error('Entre novamente para carregar sua apresentação.');
      return repository.load();
    }
    void initialize().then((saved) => {
      if (active) { setStatus(saved); setOnboardingLoaded(true); }
    })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua apresentação.');
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository]);

  async function finish(next: OnboardingStatus) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      if (!repository) throw new Error('Sessão indisponível.');
      // Re-read before retrying an ambiguous completion; the RPC itself is idempotent.
      const saved = await repository.load();
      if (saved !== next) await repository.finish(next);
      setStatus(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a apresentação.');
    } finally { pending.current = false; setBusy(false); }
  }

  if (status || manualAccess) return <WorkoutScreen initialWorkoutId={workoutId} />;

  return <GymBackground><SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Brand /><ThemePicker />
      <View style={styles.panel}>
        <Text style={styles.title}>Vamos conhecer seu objetivo?</Text>
        <Text style={styles.text}>1. Informe objetivo e rotina. 2. Gere uma sugestão local, sem IA externa. 3. Confira e salve; depois personalize na biblioteca.</Text>
        <Text style={styles.text}>Esta etapa é opcional. O questionário só é armazenado com seu consentimento; a sugestão é calculada neste aparelho.</Text>
        {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Consultando apresentação do aluno" />}
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!loading && <Pressable accessibilityRole="button" disabled={busy || assessmentBusy} style={styles.button} onPress={() => void load()}>
          <Text style={styles.link}>Atualizar estado da apresentação</Text>
        </Pressable>}
        {!loading && <Pressable accessibilityRole="button" disabled={busy || assessmentBusy} style={styles.button} onPress={() => void finish('skipped')}>
          <Text style={styles.link}>{busy ? 'Aguarde…' : 'Pular por enquanto e montar treino manual'}</Text>
        </Pressable>}
        {!loading && error && <Pressable accessibilityRole="button" disabled={busy || assessmentBusy} style={styles.button} onPress={() => setManualAccess(true)}>
          <Text style={styles.link}>Abrir painel sem registrar conclusão</Text>
        </Pressable>}
      </View>
      {!loading && onboardingLoaded && <AssessmentPanel guided disabled={busy} onBusyChange={setAssessmentBusy}
        onAssessmentReady={setHasAssessment}
        onPlanSaved={async (id) => { setWorkoutId(id); }}
      />}
      {!loading && hasAssessment && <View style={styles.panel}>
        <Text style={styles.text}>Seu objetivo foi salvo. Você pode concluir a apresentação agora ou montar uma ficha manual na biblioteca.</Text>
        <Pressable accessibilityRole="button" disabled={busy || assessmentBusy} style={styles.button} onPress={() => void finish('completed')}>
          <Text style={styles.link}>Concluir apresentação e abrir meu treino</Text>
        </Pressable>
      </View>}
    </ScrollView>
  </SafeAreaView></GymBackground>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
  panel: { padding: 22, gap: 16, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  text: { color: colors.muted, lineHeight: 23 },
  error: { color: colors.danger, lineHeight: 22 },
  button: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  link: { color: colors.primary, fontWeight: '600', lineHeight: 22 },
});
