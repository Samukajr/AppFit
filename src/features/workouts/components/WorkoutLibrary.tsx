import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedStyles, type ThemeColors } from '../../../theme';
import { ExerciseDemoLink } from './ExerciseDemoLink';
import type { createWorkoutRepository } from '../repository';
import type { CatalogExercise, DraftExercise, WorkoutSummary } from '../types';
import { buildManualWorkout, catalogCategories, exerciseGroupLabels, filterCatalog, groupsForCategory, type CatalogCategory } from '../utils';

type Props = {
  repository: ReturnType<typeof createWorkoutRepository>;
  disabled: boolean;
  activeId?: string;
  startCreating?: boolean;
  onSelect: (id: string) => Promise<void>;
  onClose: () => void;
};

export function WorkoutLibrary({ repository, disabled, activeId, startCreating = false, onSelect, onClose }: Props) {
  const { colors, styles } = useThemedStyles(createStyles);
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CatalogCategory>(startCreating ? 'all' : 'upper');
  const [group, setGroup] = useState('Todos');
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);
  const [creating, setCreating] = useState(startCreating);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const blocked = disabled || loading || saving;

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void repository.library().then((data) => {
      if (active) { setCatalog(data.catalog); setWorkouts(data.workouts); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a biblioteca.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [repository]);

  async function refresh() {
    setLoading(true); setError(null);
    try {
      const data = await repository.library();
      if (mounted.current) { setCatalog(data.catalog); setWorkouts(data.workouts); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a biblioteca.');
    } finally { if (mounted.current) setLoading(false); }
  }

  async function select(id: string) {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try { await onSelect(id); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a ficha.'); }
    finally { pending.current = false; if (mounted.current) setSaving(false); }
  }

  async function save() {
    if (pending.current) return;
    setError(null);
    let payload;
    try { payload = buildManualWorkout(name, drafts, catalog); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Revise os parâmetros da ficha.'); return; }
    pending.current = true; setSaving(true);
    const workoutId = editingId;
    let savedId: string | null = workoutId;
    let persisted = false;
    try {
      if (workoutId) await repository.update(workoutId, payload.name, payload.exercises);
      else savedId = await repository.create(payload.name, payload.exercises);
      persisted = true;
      if (mounted.current) {
        if (workoutId) {
          setWorkouts((current) => current.map((workout) => workout.id === workoutId ? { ...workout, name: payload.name } : workout));
        } else if (savedId) {
          setWorkouts((current) => [{ id: savedId!, name: payload.name, isStarter: false, archived: false }, ...current]);
        }
        setDrafts([]); setName(''); setCreating(false); setEditingId(null);
      }
      if (savedId) await onSelect(savedId);
    } catch (cause) {
      if (mounted.current) setError(persisted
        ? `A ficha foi ${workoutId ? 'atualizada' : 'salva'}, mas não foi possível abri-la. ${cause instanceof Error ? cause.message : 'Selecione-a na lista para tentar novamente.'}`
        : cause instanceof Error ? cause.message : 'Não foi possível salvar. Atualize a lista antes de repetir.');
    } finally { pending.current = false; if (mounted.current) setSaving(false); }
  }

  async function beginEdit(workoutId: string) {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      const definition = await repository.definition(workoutId, catalog);
      if (!mounted.current) return;
      setEditingId(workoutId);
      setName(definition.name);
      setDrafts(definition.exercises.map((exercise) => ({
        catalogId: exercise.catalogId,
        targetSets: 'targetSets' in exercise ? String(exercise.targetSets) : '',
        targetReps: 'targetReps' in exercise ? String(exercise.targetReps) : '',
        restSeconds: 'restSeconds' in exercise ? String(exercise.restSeconds) : '',
        targetMinutes: 'targetMinutes' in exercise ? String(exercise.targetMinutes) : '',
      })));
      setCreating(true);
      setConfirmArchiveId(null);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar esta ficha para edição.');
    } finally { pending.current = false; if (mounted.current) setSaving(false); }
  }

  async function archive(workoutId: string) {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      await repository.archive(workoutId);
      if (mounted.current) {
        setWorkouts((current) => current.map((workout) => workout.id === workoutId ? { ...workout, archived: true } : workout));
        setConfirmArchiveId(null);
        setError(null);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível arquivar a ficha.');
    } finally { pending.current = false; if (mounted.current) setSaving(false); }
  }

  async function restore(workoutId: string) {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      await repository.restore(workoutId);
      if (mounted.current) {
        setWorkouts((current) => current.map((workout) => workout.id === workoutId ? { ...workout, archived: false } : workout));
        setError(null);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar a ficha.');
    } finally { pending.current = false; if (mounted.current) setSaving(false); }
  }

  function cancelBuilder() {
    setCreating(false); setEditingId(null); setName(''); setDrafts([]);
  }

  function beginCreate(initialName = '') {
    setEditingId(null); setName(initialName); setDrafts([]); setCreating(true);
    setConfirmArchiveId(null); setError(null); setQuery(''); setCategory('all'); setGroup('Todos');
  }

  function update(id: string, field: keyof Omit<DraftExercise, 'catalogId'>, value: string) {
    setDrafts((current) => current.map((draft) => draft.catalogId === id ? { ...draft, [field]: value } : draft));
  }

  function move(index: number, direction: number) {
    setDrafts((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const groups = groupsForCategory(category, catalog);
  const matches = filterCatalog(catalog, query, group, category);

  return <View style={styles.panel}>
    <View style={styles.row}>
      <View style={styles.grow}><Text style={styles.eyebrow}>MONTE DO SEU JEITO</Text><Text style={styles.title}>Minhas fichas</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar biblioteca" disabled={blocked} onPress={onClose} style={styles.iconButton}>
        <Feather name="x" size={22} color={colors.text} />
      </Pressable>
    </View>
    <Text style={styles.text}>Cada ficha mantém sua própria sessão e histórico. Trocar de ficha não apaga o treino em andamento.</Text>
    {(loading || saving) && <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando biblioteca" />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={blocked} onPress={() => void refresh()} style={styles.secondary}>
      <Text style={styles.link}>Atualizar catálogo e fichas</Text>
    </Pressable>
    {workouts.filter((workout) => !workout.archived).map((workout) => <View key={workout.id}
      style={[styles.workout, !workout.isStarter && activeId === workout.id && styles.selected]}>
      <Pressable accessibilityRole="button" accessibilityLabel={workout.isStarter ? 'Montar treino de corpo inteiro' : `Abrir ficha ${workout.name}`}
        accessibilityState={{ selected: !workout.isStarter && activeId === workout.id, disabled: blocked || (workout.isStarter && !catalog.length) }}
        disabled={blocked || (workout.isStarter && !catalog.length)}
        onPress={() => workout.isStarter ? beginCreate('Corpo inteiro') : void select(workout.id)} style={styles.workoutSelect}>
        <Feather name={workout.isStarter ? 'file-text' : 'folder'} size={20} color={colors.secondary} />
        <View style={styles.grow}><Text style={styles.name}>{workout.isStarter ? 'Montar treino de corpo inteiro' : workout.name}</Text><Text style={styles.caption}>{workout.isStarter ? 'Crie uma nova ficha escolhendo os exercícios; nada é incluído automaticamente.' : 'Montada manualmente'}</Text></View>
        <Feather name="arrow-up-right" size={18} color={colors.primary} />
      </Pressable>
      {!workout.isStarter && <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Editar ficha ${workout.name}`} disabled={blocked}
          onPress={() => void beginEdit(workout.id)} style={styles.iconButton}><Feather name="edit-2" size={18} color={colors.secondary} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Arquivar ficha ${workout.name}`} disabled={blocked}
          onPress={() => setConfirmArchiveId(workout.id)} style={styles.iconButton}><Feather name="archive" size={18} color={colors.danger} /></Pressable>
      </View>}
      {confirmArchiveId === workout.id && <View style={styles.archiveConfirm}>
        <Text style={styles.text}>A ficha sairá da lista ativa. O histórico e os registros de treino serão preservados e poderão ser acessados na área de arquivadas.</Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={blocked} onPress={() => setConfirmArchiveId(null)} style={styles.secondary}><Text style={styles.link}>Cancelar</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={blocked} onPress={() => void archive(workout.id)} style={styles.archiveButton}><Text style={styles.archiveButtonText}>Arquivar ficha</Text></Pressable>
        </View>
      </View>}
    </View>)}
    {!loading && !workouts.some((workout) => !workout.archived) && <Text style={styles.text}>Nenhuma ficha ativa. Crie uma ficha ou restaure uma arquivada.</Text>}
    <Pressable accessibilityRole="button" disabled={blocked || catalog.length === 0} onPress={() => {
      if (creating) cancelBuilder();
      else beginCreate();
    }}
      style={[styles.button, (blocked || !catalog.length) && styles.disabled]}>
      <Text style={styles.buttonText}>{creating ? 'Cancelar edição' : 'Criar minha ficha'}</Text>
    </Pressable>
    {workouts.some((workout) => workout.archived) && <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showArchived }} disabled={blocked}
        onPress={() => setShowArchived((value) => !value)} style={styles.secondary}>
        <Text style={styles.link}>{showArchived ? 'Ocultar' : 'Ver'} fichas arquivadas ({workouts.filter((workout) => workout.archived).length})</Text>
      </Pressable>
      {showArchived && workouts.filter((workout) => workout.archived).map((workout) => <View key={workout.id}
        style={[styles.workout, activeId === workout.id && styles.selected]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ficha arquivada ${workout.name}`}
          accessibilityState={{ selected: activeId === workout.id, disabled: blocked }} disabled={blocked}
          onPress={() => void select(workout.id)} style={styles.workoutSelect}>
          <Feather name="archive" size={20} color={colors.muted} />
          <View style={styles.grow}><Text style={styles.name}>{workout.name}</Text><Text style={styles.caption}>Arquivada · histórico preservado</Text></View>
          <Feather name="arrow-up-right" size={18} color={colors.primary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Restaurar ficha ${workout.name}`} disabled={blocked}
          onPress={() => void restore(workout.id)} style={styles.iconButton}><Feather name="rotate-ccw" size={18} color={colors.secondary} /></Pressable>
      </View>)}
    </>}
    {creating && <>
      <Text style={styles.text}>{editingId ? 'Edite o nome, os exercícios e as metas desta ficha. Sessões concluídas e seus registros históricos serão preservados.' : 'Explore membros superiores e inferiores por grupo muscular, escolha os exercícios e monte sua ficha. Core e cardio também estão disponíveis. Quando houver uma demonstração revisada, ela aparecerá junto ao exercício. Defina as metas com a orientação do seu profissional; não há prescrição automática. Limite de 30 exercícios por ficha.'}</Text>
      <TextInput accessibilityLabel={editingId ? 'Nome da ficha editada' : 'Nome da nova ficha'} placeholder="Nome da ficha (ex.: Peito e tríceps)"
        placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={120} editable={!blocked} style={styles.input} />
      <Text style={styles.subtitle}>1. Escolha uma área · {catalog.length} exercícios</Text>
      <TextInput accessibilityLabel="Buscar exercício ou equipamento" placeholder="Buscar exercício ou equipamento"
        placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} editable={!blocked} style={styles.input} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {catalogCategories.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === category }}
          disabled={blocked} onPress={() => { setCategory(item.id); setGroup('Todos'); }} style={[styles.chip, item.id === category && styles.selected]}>
          <Text style={styles.link}>{item.label}</Text>
        </Pressable>)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {['Todos', ...groups].map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === group }}
          disabled={blocked} onPress={() => setGroup(item)} style={[styles.chip, item === group && styles.selected]}>
          <Text style={styles.link}>{exerciseGroupLabels[item] ?? item}</Text>
        </Pressable>)}
      </ScrollView>
      <Text style={styles.caption}>{matches.length} resultados · {drafts.length}/30 selecionados</Text>
      {matches.length === 0 && <Text style={styles.text}>Nenhum exercício corresponde a esta área ou busca. Tente outro grupo ou escolha Todos.</Text>}
      {matches.map((entry) => {
        const selected = drafts.some((draft) => draft.catalogId === entry.id);
        return <View key={entry.id} style={styles.catalogRow}>
          <View style={styles.grow}><Text style={styles.name}>{entry.name}</Text><Text style={styles.caption}>{exerciseGroupLabels[entry.muscleGroup] ?? entry.muscleGroup} · {entry.equipment}</Text>
            <ExerciseDemoLink exerciseName={entry.name} demonstration={entry.demonstration} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${selected ? 'Remover' : 'Adicionar'} ${entry.name} ${selected ? 'da' : 'à'} ficha`}
            disabled={blocked || (!selected && drafts.length >= 30)} onPress={() => {
              setDrafts((current) => selected ? current.filter((draft) => draft.catalogId !== entry.id)
                : [...current, { catalogId: entry.id, targetSets: '', targetReps: '', restSeconds: '', targetMinutes: '' }]);
            }} style={styles.iconButton}>
            <Feather name={selected ? 'check-circle' : 'plus-circle'} size={24} color={selected ? colors.primary : colors.secondary} />
          </Pressable>
        </View>;
      })}
      <Text style={styles.subtitle}>2. Configure sua ficha · {drafts.length} exercícios</Text>
      {drafts.length === 0 && <Text style={styles.text}>Adicione exercícios à biblioteca acima para configurar sua ficha.</Text>}
      {drafts.map((draft, index) => {
        const entry = catalog.find((item) => item.id === draft.catalogId);
        if (!entry) return <Text key={draft.catalogId} accessibilityRole="alert" style={styles.error}>Exercício removido do catálogo. Atualize a biblioteca.</Text>;
        const fields: { key: keyof Omit<DraftExercise, 'catalogId'>; label: string }[] = entry.kind === 'cardio'
          ? [{ key: 'targetMinutes', label: 'Minutos (1–600)' }]
          : [{ key: 'targetSets', label: 'Séries (1–100)' }, { key: 'targetReps', label: 'Repetições (1–1000)' }, { key: 'restSeconds', label: 'Descanso (5–600 s)' }];
        return <View key={draft.catalogId} style={styles.draft}>
          <Text style={styles.name}>{index + 1}. {entry.name}</Text>
          <ExerciseDemoLink exerciseName={entry.name} demonstration={entry.demonstration} />
          <View style={styles.fields}>{fields.map((field) => <View key={field.key} style={styles.field}>
            <Text style={styles.caption}>{field.label}</Text>
            <TextInput accessibilityLabel={`${field.label} para ${entry.name}`} value={draft[field.key]} keyboardType="number-pad"
              maxLength={4} onChangeText={(value) => update(draft.catalogId, field.key, value)} editable={!blocked} style={styles.input} />
          </View>)}</View>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mover ${entry.name} para cima`} disabled={blocked || index === 0} onPress={() => move(index, -1)} style={[styles.iconButton, index === 0 && styles.disabled]}><Feather name="arrow-up" size={18} color={colors.secondary} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mover ${entry.name} para baixo`} disabled={blocked || index === drafts.length - 1} onPress={() => move(index, 1)} style={[styles.iconButton, index === drafts.length - 1 && styles.disabled]}><Feather name="arrow-down" size={18} color={colors.secondary} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Excluir ${entry.name} do rascunho`} disabled={blocked} onPress={() => setDrafts((current) => current.filter((item) => item.catalogId !== draft.catalogId))} style={styles.iconButton}><Text style={styles.error}>Remover</Text></Pressable>
          </View>
        </View>;
      })}
      <Pressable accessibilityRole="button" disabled={blocked || drafts.length === 0} onPress={() => void save()}
        style={[styles.button, (blocked || drafts.length === 0) && styles.disabled]}><Text style={styles.buttonText}>{editingId ? 'Salvar alterações e abrir ficha' : 'Salvar ficha e iniciar treino'}</Text></Pressable>
      <Text style={styles.caption}>As alterações só são salvas ao confirmar. Sessões e séries históricas são preservadas. Um treino em andamento com registros precisa ser concluído antes de editar sua ficha.</Text>
    </>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 20, gap: 18 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  grow: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
  text: { color: colors.muted, lineHeight: 22, fontSize: 13 },
  caption: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15, lineHeight: 22 },
  workout: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, flexWrap: 'wrap' },
  workoutSelect: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 6, flex: 1, minWidth: 180 },
  archiveConfirm: { width: '100%', padding: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  archiveButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.danger },
  archiveButtonText: { color: colors.background, fontWeight: '800' },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  button: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, minHeight: 52, alignItems: 'center' },
  buttonText: { color: colors.background, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  secondary: { minHeight: 48, justifyContent: 'center' },
  link: { color: colors.secondary, fontSize: 13 },
  error: { color: colors.danger, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, borderRadius: 12, padding: 12, minHeight: 48, fontSize: 15 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 14, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 24 },
  catalogRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  iconButton: { padding: 12, minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  draft: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, gap: 12 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { flexGrow: 1, flexBasis: 110, gap: 6 },
});
