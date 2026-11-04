import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { createWorkoutRepository } from '../workouts/repository';
import { ExerciseDemoLink } from '../workouts/components/ExerciseDemoLink';
import type { CatalogExercise } from '../workouts/types';

type Topic = 'execution' | 'load' | 'pain' | 'edit';

export function AssistantPanel({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { client } = useAuth();
  const repository = useMemo(() => client ? createWorkoutRepository(client) : null, [client]);
  const { styles, colors } = useThemedStyles(createStyles);
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selected = catalog.find((exercise) => exercise.id === selectedId);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!repository) throw new Error('Sessão indisponível. Entre novamente para carregar o catálogo.');
      return repository.library();
    }).then(({ catalog: entries }) => {
      if (active) setCatalog(entries);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o catálogo.');
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [repository]);

  return <View style={styles.panel}>
    <Text style={styles.title}>Guia local de treino</Text>
    <Text style={styles.text}>Este guia não é uma IA conversacional. As orientações abaixo são locais e não enviam perguntas, avaliações ou dados de saúde a serviços externos.</Text>
    {busy && <ActivityIndicator accessibilityLabel="Carregando catálogo de exercícios" color={colors.primary} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Text style={styles.label}>Escolha uma dúvida</Text>
    <View style={styles.row}>
      <TopicButton label="Ver execução" active={topic === 'execution'} onPress={() => setTopic('execution')} styles={styles} />
      <TopicButton label="Escolher carga" active={topic === 'load'} onPress={() => setTopic('load')} styles={styles} />
      <TopicButton label="Dor ou desconforto" active={topic === 'pain'} onPress={() => setTopic('pain')} styles={styles} />
      <TopicButton label="Editar ficha" active={topic === 'edit'} onPress={() => setTopic('edit')} styles={styles} />
    </View>
    {topic === 'execution' && <>
      <Text style={styles.text}>Selecione um exercício para abrir um vídeo já cadastrado ou uma busca no YouTube. Os resultados da busca não são revisados pelo app.</Text>
      <View style={styles.row}>
        {catalog.filter((exercise) => exercise.kind === 'strength').map((exercise) => <Pressable key={exercise.id}
          accessibilityRole="button" accessibilityState={{ selected: exercise.id === selectedId }}
          style={[styles.chip, exercise.id === selectedId && styles.selected]}
          onPress={() => setSelectedId(exercise.id)}>
          <Text style={styles.link}>{exercise.name}</Text>
        </Pressable>)}
      </View>
      {selected && <View style={styles.message}>
        <Text style={styles.label}>{selected.name}</Text>
        <ExerciseDemoLink exerciseName={selected.name} demonstration={selected.demonstration} />
      </View>}
    </>}
    {topic === 'load' && <Text style={styles.text}>Este guia não prescreve carga. Se estiver começando, peça ao profissional da academia que acompanhe a execução e escolha uma carga inicial adequada. Interrompa se a execução perder o controle ou causar dor.</Text>}
    {topic === 'pain' && <Text style={styles.text}>Não use o app para avaliar sintomas. Pare o exercício se sentir dor, tontura ou mal-estar e procure orientação de um profissional de saúde antes de retomar. Em uma situação urgente, procure o serviço de emergência local.</Text>}
    {topic === 'edit' && <>
      <Text style={styles.text}>Você pode revisar e alterar exercícios, séries, repetições, descanso e nome na biblioteca.</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={onOpenLibrary}>
        <Text style={styles.link}>Abrir minhas fichas e biblioteca</Text>
      </Pressable>
    </>}
  </View>;
}

function TopicButton({ label, active, onPress, styles }: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }}
    style={[styles.chip, active && styles.selected]} onPress={onPress}>
    <Text style={styles.link}>{label}</Text>
  </Pressable>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { padding: 22, gap: 16, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 23, fontWeight: '700' },
  text: { color: colors.muted, lineHeight: 22 },
  label: { color: colors.text, fontWeight: '600', lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { padding: 10, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  link: { color: colors.primary, fontWeight: '600', lineHeight: 22 },
  message: { padding: 16, gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  button: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primarySoft },
  error: { color: colors.danger, lineHeight: 22 },
});
