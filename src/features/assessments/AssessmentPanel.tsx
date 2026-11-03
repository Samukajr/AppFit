import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File as LocalFile } from 'expo-file-system';
import { useAuth } from '../auth/AuthProvider';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { buildAssessment, emptyDraft, experiences, goals, validateAttachment, validateFileSignature,
  type Assessment, type AssessmentDocument, type AssessmentDraft } from './contract';
import { createAssessmentRepository } from './repository';
import type { CatalogExercise } from '../workouts/types';
import type { WorkoutPlanResult } from '../../../supabase/functions/_shared/gemini-workout.ts';

const fields: { key: keyof AssessmentDraft; label: string; max: number; numeric?: boolean }[] = [
  { key: 'days', label: 'Dias disponíveis por semana (1–7)', max: 1, numeric: true },
  { key: 'minutes', label: 'Minutos disponíveis por sessão (10–180)', max: 3, numeric: true },
  { key: 'equipment', label: 'Equipamentos e local disponíveis', max: 1000 },
  { key: 'limitations', label: 'Limitações ou desconfortos que deseja informar (opcional)', max: 2000 },
  { key: 'guidance', label: 'Restrições e orientações do seu profissional (opcional)', max: 2000 },
  { key: 'measuredOn', label: 'Data da medição, AAAA-MM-DD (opcional)', max: 10 },
  { key: 'weight', label: 'Peso em kg (opcional)', max: 6, numeric: true },
  { key: 'height', label: 'Altura em cm (opcional)', max: 6, numeric: true },
  { key: 'bodyFat', label: 'Gordura corporal em % (opcional)', max: 6, numeric: true },
  { key: 'muscleMass', label: 'Massa muscular em kg (opcional)', max: 6, numeric: true },
];

type PendingPlan = { generationId: string; plan: WorkoutPlanResult; catalog: CatalogExercise[] };

export function AssessmentPanel({ onBusyChange, onPlanSaved, disabled = false }: {
  onBusyChange: (busy: boolean) => void;
  onPlanSaved: (workoutId: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { client, session } = useAuth();
  const userId = session?.user.id;
  const repository = useMemo(() => client && userId ? createAssessmentRepository(client, userId) : null, [client, userId]);
  const { styles, colors } = useThemedStyles(createStyles);
  const [records, setRecords] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [documents, setDocuments] = useState<AssessmentDocument[]>([]);
  const [draft, setDraft] = useState<AssessmentDraft>({ ...emptyDraft });
  const [creating, setCreating] = useState(false);
  const [consent, setConsent] = useState(false);
  const [working, setBusy] = useState(true);
  const busy = working || disabled;
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [geminiConsent, setGeminiConsent] = useState(false);
  const [aiDocumentId, setAiDocumentId] = useState<string | null>(null);
  const [geminiWorkoutsEnabled, setGeminiWorkoutsEnabled] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [workoutAdultConfirmed, setWorkoutAdultConfirmed] = useState(false);
  const [workoutConsent, setWorkoutConsent] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    onBusyChange(working);
    return () => { onBusyChange(false); };
  }, [working, onBusyChange]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    async function initialize() {
      if (!repository) throw new Error('Entre novamente para consultar avaliações.');
      return repository.list();
    }
    void initialize().then((data) => { if (active) setRecords(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao consultar avaliações.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; mounted.current = false; };
  }, [repository]);

  async function run(action: (repo: NonNullable<typeof repository>) => Promise<void>) {
    if (pending.current) return;
    if (disabled) { setError('Aguarde a operação atual antes de alterar avaliações.'); return; }
    pending.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      if (!repository) throw new Error('Entre novamente para acessar avaliações.');
      await action(repository);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação. Atualize os dados antes de repetir.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function upload() {
    if (!selected || !repository || pending.current) return;
    const assessmentId = selected.id;
    await run(async (repo) => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'], multiple: false, copyToCacheDirectory: true, base64: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      let local: LocalFile | undefined;
      try {
        if (Platform.OS !== 'web') local = new LocalFile(asset.uri);
        const descriptor = validateAttachment(asset.name, asset.mimeType, asset.size ?? asset.file?.size ?? local?.size);
        const buffer = Platform.OS === 'web' && asset.file ? await asset.file.arrayBuffer()
          : local ? await local.arrayBuffer() : null;
        if (!buffer) throw new Error('Não foi possível ler o documento selecionado.');
        if (buffer.byteLength !== descriptor.size) throw new Error('Tamanho do documento inconsistente.');
        validateFileSignature(new Uint8Array(buffer), descriptor.mimeType);
        const document = await repo.beginDocument(assessmentId, descriptor.name, descriptor.mimeType, descriptor.size);
        if (mounted.current) setDocuments((current) => [document, ...current]);
        await repo.upload(document, buffer);
        await repo.confirmDocument(document.id);
        const next = await repo.documents(assessmentId);
        if (mounted.current) { setDocuments(next); setMessage('Documento privado salvo. Nenhuma leitura ou envio à IA ocorre automaticamente.'); }
      } finally {
        if (local) {
          try { local.delete(); }
          catch { if (mounted.current) setError('Não foi possível apagar a cópia temporária local. O arquivo original não foi alterado.'); }
        }
      }
    });
  }

  function select(record: Assessment) {
    void run(async (repo) => {
      const next = await repo.documents(record.id);
      if (mounted.current) {
        setSelected(record); setDocuments(next); setDocumentsLoaded(true); setRemoveId(null); setAiDocumentId(null); setGeminiConsent(false);
        setSelectedDocumentIds([]); setWorkoutAdultConfirmed(false); setWorkoutConsent(false); setPendingPlan(null);
      }
    });
  }

  function generatePlan() {
    if (!selected) return;
    void run(async (repo) => {
      const result = await repo.generateWorkoutPlan(selected.id, selected.days_per_week, selectedDocumentIds,
        workoutAdultConfirmed, workoutConsent);
      if (mounted.current) {
        setPendingPlan(result);
        setWorkoutAdultConfirmed(false);
        setWorkoutConsent(false);
        setMessage(result.plan.status === 'ready'
          ? 'Proposta gerada. Confira todas as fichas e avisos; nada foi salvo ainda.'
          : 'A IA sinalizou que é necessária avaliação profissional. Nenhuma ficha foi criada.');
      }
    });
  }

  function savePlan() {
    if (!pendingPlan || pendingPlan.plan.status !== 'ready') return;
    const plan = pendingPlan.plan;
    void run(async (repo) => {
      const ids = await repo.saveWorkoutPlan(pendingPlan.generationId, plan.workouts);
      if (mounted.current) {
        setPendingPlan(null);
        setSelectedDocumentIds([]);
        setMessage(`${ids.length} fichas salvas após sua confirmação. A primeira foi aberta para iniciar.`);
      }
      try {
        await onPlanSaved(ids[0]);
      } catch (cause) {
        throw new Error(`As fichas foram salvas, mas não foi possível abrir a primeira. Selecione-a na biblioteca. ${cause instanceof Error ? cause.message : ''}`);
      }
    });
  }

  return <View style={styles.panel}>
    <Text style={styles.eyebrow}>AVALIAÇÕES E ANAMNESE</Text>
    <Text style={styles.title}>Seu contexto, antes do treino</Text>
    <View style={styles.notice}>
      <Text style={styles.text}>A IA pode transcrever medidas para sua conferência e, quando habilitada, sugerir fichas de treino a partir da sua avaliação, disponibilidade e limitações informadas. Ela não diagnostica, interpreta clinicamente exames nem libera exercícios; a proposta precisa da sua revisão e confirmação.</Text>
      <Text style={styles.text}>Dados de saúde e medidas selecionadas só são enviados ao Google com consentimento específico, confirmação de 18 anos ou mais e serviço habilitado no servidor.</Text>
      <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => void run(async (repo) => {
        setGeminiEnabled(false);
        setGeminiWorkoutsEnabled(false);
        const status = await repo.geminiStatus();
        if (mounted.current) {
          setGeminiEnabled(status.documents); setGeminiWorkoutsEnabled(status.workouts);
          setMessage(status.documents || status.workouts
            ? 'Serviços Gemini habilitados no servidor. Cada ação exige consentimento específico.'
            : 'Gemini desativado no servidor. Nenhum documento ou dado de avaliação foi enviado.');
        }
      })}><Text style={styles.link}>Verificar disponibilidade do Gemini</Text></Pressable>
    </View>
    {busy && <ActivityIndicator accessibilityLabel="Atualizando avaliações" color={colors.primary} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
    <View style={styles.row}>
      <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => void run(async (repo) => {
        const next = await repo.list();
        if (mounted.current) setRecords(next);
        if (selected) {
          const nextDocuments = await repo.documents(selected.id);
          if (mounted.current) { setDocuments(nextDocuments); setDocumentsLoaded(true); }
        }
      })}><Text style={styles.link}>Atualizar avaliações</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => setCreating(!creating)}>
        <Text style={styles.link}>{creating ? 'Recolher formulário (manter rascunho)' : 'Nova avaliação e anamnese'}</Text>
      </Pressable>
    </View>
    {creating && <View style={styles.form}>
      <Text style={styles.subtitle}>Objetivo informado</Text>
      <View style={styles.row}>{Object.entries(goals).map(([key, label]) => <Pressable key={key} accessibilityRole="button" disabled={busy}
        accessibilityState={{ selected: draft.goal === key }} onPress={() => setDraft((current) => ({ ...current, goal: key }))}
        style={[styles.chip, draft.goal === key && styles.selected]}><Text style={styles.link}>{label}</Text></Pressable>)}</View>
      <Text style={styles.subtitle}>Experiência com treino</Text>
      <View style={styles.row}>{Object.entries(experiences).map(([key, label]) => <Pressable key={key} accessibilityRole="button" disabled={busy}
        accessibilityState={{ selected: draft.experience === key }} onPress={() => setDraft((current) => ({ ...current, experience: key }))}
        style={[styles.chip, draft.experience === key && styles.selected]}><Text style={styles.link}>{label}</Text></Pressable>)}</View>
      <Text style={styles.text}>Medidas são opcionais. Transcreva somente valores e unidades que você conferiu no documento. Não estime dados ausentes. Os limites dos campos são validações técnicas, não faixas clínicas.</Text>
      {fields.map((field) => <View key={field.key} style={styles.field}>
        <Text style={styles.label}>{field.label}</Text>
        <TextInput accessibilityLabel={field.label} editable={!busy} value={draft[field.key]} maxLength={field.max}
          keyboardType={field.numeric ? 'decimal-pad' : 'default'} autoCapitalize={field.numeric ? 'none' : 'sentences'}
          multiline={field.max > 120} style={styles.input} onChangeText={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} />
      </View>)}
      <View style={styles.row}>
        <Switch accessibilityLabel="Autorizo armazenar meus dados de avaliação e saúde" disabled={busy} value={consent} onValueChange={setConsent}
          trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={consent ? colors.primary : colors.muted} />
        <Text style={[styles.text, styles.grow]}>Revisei os dados e autorizo explicitamente o armazenamento destes dados de saúde e dos anexos desta avaliação no Supabase para organizar meu acompanhamento. Posso remover anexos e solicitar exclusão da conta e dos dados. Isso não autoriza envio a IA.</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void run(async (repo) => {
        const payload = buildAssessment(draft, consent);
        const saved = await repo.save(payload);
        if (mounted.current) {
          setRecords((current) => [saved, ...current].slice(0, 10)); setSelected(saved);
          setDocuments([]); setDocumentsLoaded(true); setDraft({ ...emptyDraft }); setConsent(false); setCreating(false);
          setAiDocumentId(null); setGeminiConsent(false);
          setMessage('Avaliação salva. Você pode anexar os documentos abaixo. Não foi feita análise por IA.');
        }
      })}><Text style={styles.buttonText}>Salvar dados revisados</Text></Pressable>
      <Text style={styles.text}>O rascunho não é salvo automaticamente e será descartado ao fechar a área ou sair do app. Dados salvos são registros históricos; novas medições devem ser salvas como nova avaliação.</Text>
    </View>}
    <Text style={styles.subtitle}>Últimas 10 avaliações</Text>
    {!busy && !records.length && <Text style={styles.text}>Nenhuma avaliação salva.</Text>}
    {records.map((record) => <Pressable key={record.id} accessibilityRole="button" disabled={busy}
      accessibilityLabel={`Abrir avaliação ${record.id}`} accessibilityState={{ selected: selected?.id === record.id }}
      style={[styles.record, selected?.id === record.id && styles.selected]} onPress={() => select(record)}>
      <Text style={styles.subtitle}>{goals[record.goal]}</Text>
      <Text style={styles.text}>{new Date(record.created_at).toLocaleString('pt-BR')} · Dados informados pelo usuário</Text>
    </Pressable>)}
    {selected && <View style={styles.form}>
      <Text style={styles.subtitle}>Avaliação selecionada</Text>
      <Text style={styles.text}>{goals[selected.goal]} · {experiences[selected.experience]}</Text>
      <Text style={styles.text}>{selected.days_per_week} dias/semana · {selected.session_minutes} min/sessão</Text>
      <Text style={styles.text}>Equipamentos: {selected.equipment}</Text>
      <Text style={styles.text}>Limitações: {selected.limitations || 'Não informadas'}</Text>
      <Text style={styles.text}>Orientações: {selected.professional_guidance || 'Não informadas'}</Text>
      <Text style={styles.text}>Data da medição: {selected.measured_on ?? 'Não informada'}</Text>
      <Text style={styles.text}>Peso: {selected.weight_kg === null ? 'Não informado' : `${selected.weight_kg} kg`} · Altura: {selected.height_cm === null ? 'Não informada' : `${selected.height_cm} cm`}</Text>
      <Text style={styles.text}>Gordura: {selected.body_fat_percent === null ? 'Não informada' : `${selected.body_fat_percent}%`} · Massa muscular: {selected.muscle_mass_kg === null ? 'Não informada' : `${selected.muscle_mass_kg} kg`}</Text>
      <Text style={styles.subtitle}>Documentos privados · {documents.length}/5</Text>
      <Text style={styles.text}>PDF, JPEG ou PNG de até 10 MB. Anexar não envia o arquivo à IA. Para usar medidas de um exame no plano, solicite a transcrição, confira cada valor no original e selecione o documento abaixo. Remover um anexo apaga o arquivo do armazenamento.</Text>
      <Pressable accessibilityRole="button" disabled={busy || !documentsLoaded || documents.length >= 5} style={[styles.secondary, (busy || documents.length >= 5) && styles.disabled]}
        onPress={() => void upload()}><Text style={styles.link}>Anexar documento privado</Text></Pressable>
      {documents.map((document) => <View key={document.id} style={styles.record}>
        <Text style={styles.subtitle}>{document.display_name}</Text>
        <Text style={styles.text}>{document.uploaded_at ? 'Arquivo privado confirmado' : 'Envio não confirmado · Verifique antes de repetir'}</Text>
        {document.extraction_status === 'processing' && <Text style={styles.text}>Leitura em andamento. Atualize avaliações para consultar. Se interrompida, aguarde cinco minutos antes de repetir.</Text>}
        {document.extraction_status === 'failed' && <Text style={styles.error}>A última leitura não foi confirmada. Nenhum dado manual foi alterado. A tentativa conta para o limite diário.</Text>}
        {document.extraction && <View style={styles.form}>
          <Text style={styles.subtitle}>Transcrição Gemini · {document.extraction_reviewed_at ? 'Conferida pelo usuário' : 'Não conferida'}</Text>
          <Text style={styles.text}>Compare cada valor com o documento original. IA pode errar. Esta conferência não é aprovação profissional. Nenhuma medida da avaliação será substituída automaticamente. Se houver erro, não confirme; registre os dados corretos manualmente em nova avaliação.</Text>
          {document.extraction.measurements.map((measure, index) => <View key={index}>
            <Text style={styles.label}>{measure.label}: {measure.value} {measure.unit}</Text>
            <Text style={styles.text}>Página {measure.page} · Trecho: {measure.source}</Text>
          </View>)}
          {document.extraction.warnings.map((warning, index) => <Text key={index} style={styles.text}>{warning}</Text>)}
          {!document.extraction_reviewed_at && <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => void run(async (repo) => {
            await repo.reviewExtraction(document.id);
            const next = await repo.documents(selected.id);
            if (mounted.current) setDocuments(next);
          })}><Text style={styles.link}>Conferi todos os valores no documento original</Text></Pressable>}
          {document.extraction_reviewed_at && <Pressable accessibilityRole="button" disabled={busy}
            accessibilityState={{ selected: selectedDocumentIds.includes(document.id) }} style={styles.secondary}
            onPress={() => {
              setSelectedDocumentIds((current) => current.includes(document.id)
                ? current.filter((id) => id !== document.id) : [...current, document.id]);
              setPendingPlan(null);
            }}>
            <Text style={styles.link}>{selectedDocumentIds.includes(document.id)
              ? 'Remover medidas deste documento do plano' : 'Incluir medidas conferidas no plano de treino'}</Text>
          </Pressable>}
        </View>}
        {document.uploaded_at && document.extraction_status !== 'succeeded' &&
          <Pressable accessibilityRole="button" disabled={busy || !geminiEnabled} style={[styles.secondary, !geminiEnabled && styles.disabled]} onPress={() => {
            setAiDocumentId(document.id); setGeminiConsent(false); setAdultConfirmed(false);
          }}><Text style={styles.link}>Preparar leitura Gemini de {document.display_name}</Text></Pressable>}
        {aiDocumentId === document.id && <View style={styles.form}>
          <Text style={styles.text}>Você enviará este arquivo completo, inclusive eventuais identificadores presentes nele, ao Google para transcrição de medidas. Prefira uma cópia sem identificadores desnecessários. Serviço externo pode processar dados no exterior e reter registros limitados de segurança; exclusão no app não garante remoção desses registros do provedor. Não envie dados de outras pessoas. Até 3 tentativas por dia UTC, com intervalo de um minuto, incluindo falhas.</Text>
          <View style={styles.row}>
            <Switch accessibilityLabel="Confirmo ter 18 anos ou mais" disabled={busy} value={adultConfirmed} onValueChange={setAdultConfirmed}
              trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={adultConfirmed ? colors.primary : colors.muted} />
            <Text style={[styles.text, styles.grow]}>Confirmo ter 18 anos ou mais.</Text>
          </View>
          <View style={styles.row}>
            <Switch accessibilityLabel="Autorizo enviar este documento ao Google Gemini" disabled={busy} value={geminiConsent} onValueChange={setGeminiConsent}
              trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={geminiConsent ? colors.primary : colors.muted} />
            <Text style={[styles.text, styles.grow]}>Li a política de privacidade e autorizo o envio deste documento de saúde ao Google Gemini, com o tratamento descrito acima, para transcrição e armazenamento do resultado privado no app.</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={busy || !geminiEnabled || !adultConfirmed || !geminiConsent} style={styles.secondary} onPress={() => void run(async (repo) => {
            await repo.analyzeDocument(document.id, adultConfirmed, geminiConsent);
            const next = await repo.documents(selected.id);
            if (mounted.current) { setDocuments(next); setAiDocumentId(null); setGeminiConsent(false); setMessage('Transcrição salva. Confira cada valor antes de confirmar.'); }
          })}><Text style={styles.link}>Enviar somente este documento para leitura</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => { setAiDocumentId(null); setGeminiConsent(false); }}>
            <Text style={styles.link}>Cancelar sem enviar</Text>
          </Pressable>
        </View>}
        {!document.uploaded_at && <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary}
          onPress={() => void run(async (repo) => {
            await repo.confirmDocument(document.id);
            const next = await repo.documents(selected.id);
            if (mounted.current) setDocuments(next);
          })}><Text style={styles.link}>Verificar envio de {document.display_name}</Text></Pressable>}
        <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => setRemoveId(removeId === document.id ? null : document.id)}>
          <Text style={styles.error}>{removeId === document.id ? 'Cancelar remoção' : `Remover anexo ${document.display_name}`}</Text>
        </Pressable>
        {removeId === document.id && <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => void run(async (repo) => {
          await repo.removeDocument(document);
          const next = await repo.documents(selected.id);
          if (mounted.current) {
            setDocuments(next); setRemoveId(null); setMessage('Anexo removido.');
            setSelectedDocumentIds((current) => current.filter((id) => id !== document.id));
            setPendingPlan(null);
          }
        })}><Text style={styles.error}>Confirmar remoção permanente do anexo</Text></Pressable>}
      </View>)}
      <View style={styles.notice}>
        <Text style={styles.subtitle}>Montar plano semanal com IA</Text>
        <Text style={styles.text}>A proposta pode criar uma ficha diferente para cada dia disponível ({selected.days_per_week} dias/semana), por exemplo peito e tríceps em um dia e costas e bíceps em outro. Use somente medidas de documentos que você conferiu e selecionou. Nenhuma ficha será salva sem sua confirmação.</Text>
        <Text style={styles.text}>A IA usa objetivo, experiência, tempo, equipamentos e limitações informadas para organizar exercícios do catálogo. Valores de exames são contexto conferido, não diagnóstico nem indicação clínica. Não envie laudos de outras pessoas.</Text>
        <Text style={styles.text}>Hipertrofia e emagrecimento recebem propostas gerais de força, sem dieta, cargas ou promessa de resultado. Reabilitação/fisioterapia exige avaliação de profissional habilitado: não serão gerados exercícios terapêuticos automaticamente.</Text>
        {!geminiWorkoutsEnabled && <Text style={styles.error}>Geração por IA indisponível: o serviço está desativado ou ainda não configurado no servidor.</Text>}
        {selectedDocumentIds.length > 0 && <Text style={styles.text}>{selectedDocumentIds.length} documento(s) conferido(s) incluído(s). Apenas medidas transcritas, não o arquivo original, serão enviadas nesta solicitação.</Text>}
        <View style={styles.row}>
          <Switch accessibilityLabel="Confirmo ter 18 anos ou mais para gerar treino com IA" disabled={busy || !geminiWorkoutsEnabled}
            value={workoutAdultConfirmed} onValueChange={setWorkoutAdultConfirmed}
            trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={workoutAdultConfirmed ? colors.primary : colors.muted} />
          <Text style={[styles.text, styles.grow]}>Confirmo ter 18 anos ou mais.</Text>
        </View>
        <View style={styles.row}>
          <Switch accessibilityLabel="Autorizo enviar dados selecionados para gerar proposta de treino" disabled={busy || !geminiWorkoutsEnabled}
            value={workoutConsent} onValueChange={setWorkoutConsent}
            trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={workoutConsent ? colors.primary : colors.muted} />
          <Text style={[styles.text, styles.grow]}>Autorizo enviar esta avaliação e somente as medidas dos documentos conferidos que selecionei ao Google Gemini para gerar uma proposta geral de treino. Entendo que não há diagnóstico nem liberação clínica e que o serviço pode processar dados no exterior.</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={busy || !geminiWorkoutsEnabled || !workoutAdultConfirmed || !workoutConsent}
          style={[styles.button, (busy || !geminiWorkoutsEnabled || !workoutAdultConfirmed || !workoutConsent) && styles.disabled]}
          onPress={generatePlan}><Text style={styles.buttonText}>Gerar proposta de treino por IA</Text></Pressable>
      </View>
      {pendingPlan && <View style={styles.form}>
        {pendingPlan.plan.status === 'professional_review' ? <>
          <Text style={styles.subtitle}>Avaliação profissional necessária</Text>
          <Text style={styles.text}>Nenhuma ficha foi criada. Os dados informados precisam de avaliação de um profissional habilitado antes de montar exercícios.</Text>
          {pendingPlan.plan.reasons.map((reason, index) => <Text key={index} style={styles.error}>{reason}</Text>)}
        </> : <>
          <Text style={styles.subtitle}>{pendingPlan.plan.title}</Text>
          <Text style={styles.text}>Confira a divisão e os exercícios. A IA não definiu cargas. Ajuste qualquer item com um profissional; salve somente se a proposta fizer sentido para você.</Text>
          <Text style={styles.text}>Proposta geral — não substitui avaliação, diagnóstico ou orientação de profissional habilitado.</Text>
          {pendingPlan.plan.warnings.map((warning, index) => <Text key={index} style={styles.error}>{warning}</Text>)}
          {pendingPlan.plan.workouts.map((workout, dayIndex) => <View key={`${dayIndex}-${workout.name}`} style={styles.record}>
            <Text style={styles.subtitle}>{dayIndex + 1}. {workout.name}</Text>
            <Text style={styles.text}>Foco: {workout.focus}</Text>
            {workout.exercises.map((exercise) => {
              const catalogEntry = pendingPlan.catalog.find((entry) => entry.id === exercise.catalogId);
              return <Text key={exercise.catalogId} style={styles.text}>
                {catalogEntry?.name ?? 'Exercício indisponível'} · {exercise.targetSets} × {exercise.targetReps} · descanso {exercise.restSeconds}s
              </Text>;
            })}
          </View>)}
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && styles.disabled]}
            onPress={savePlan}><Text style={styles.buttonText}>Confirmar e salvar todas as fichas</Text></Pressable>
        </>}
        <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary}
          onPress={() => setPendingPlan(null)}><Text style={styles.error}>Descartar proposta sem salvar</Text></Pressable>
      </View>}
    </View>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { padding: 20, gap: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 23, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  text: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  label: { color: colors.text, fontSize: 12, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  grow: { flex: 1, minWidth: 150 },
  form: { gap: 16 },
  field: { gap: 8 },
  input: { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 48 },
  chip: { borderWidth: 1, borderColor: colors.border, padding: 12, minHeight: 44, borderRadius: 12 },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  record: { padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  notice: { backgroundColor: colors.elevated, padding: 16, borderRadius: 14, gap: 12 },
  button: { backgroundColor: colors.primary, padding: 16, minHeight: 48, borderRadius: 12 },
  buttonText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: { paddingVertical: 12, minHeight: 44 },
  link: { color: colors.primary, fontSize: 12, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 20 },
  disabled: { opacity: 0.45 },
});
