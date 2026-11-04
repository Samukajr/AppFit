# FitVision AI

Base mobile Expo SDK 57 + TypeScript para treinos, nutricao e avaliacoes.

## Acesso online para testes

Versao web publicada em 03/11/2026 no EAS Hosting (login com senha):
https://marombafit-samukajr82.expo.app/login

Abre no navegador do computador, Android e iPhone sem depender do servidor
local ou de instalacao nativa. O codigo atual usa e-mail e senha; cadastros
podem exigir uma confirmacao inicial por e-mail, conforme a configuracao do
Supabase. Contas existentes que usavam link de acesso devem usar "Esqueci
minha senha" uma vez para criar uma senha. A publicacao de 03/11 confirmou as
telas de acesso, cadastro e recuperacao, alem do bundle publicado; nao validou
entrega de e-mail real. A apresentacao inicial e o assistente descritos abaixo
sao alteracoes locais posteriores e ainda precisam de publicacao.

A interface publica exige autenticacao para os dados de treino/avaliacao.
Nao e uma publicacao nas lojas nem um APK/IPA. EAS Hosting possui cotas;
nenhuma assinatura paga foi ativada nesta publicacao. Gemini continua
desativado, inclusive na versao online.

Exportacao SPA (`web.output=single`) suporta acesso direto a `/login` e
`/auth/callback`. Publique apenas `dist`, nunca a pasta do projeto: somente
artefatos web, foto autorizada e configuracao publica Supabase. Nao incluir
exames, .env, chaves privadas, arquivos SQL ou source maps.

```powershell
npx expo export --platform web
npx eas-cli@latest deploy --prod --dev-domain marombafit-samukajr82 --non-interactive --no-source-maps --environment preview
```

O alias principal usa `--prod` para manter URL estavel; trata-se de ambiente
de testes do produto, nao de certificacao de prontidao para producao.
O bundle incorpora EXPO_PUBLIC_* na exportacao: confira as variaveis locais
e do ambiente EAS antes de republicar. Mudancas de codigo exigem nova exportacao.
Nao compartilhe URLs efemeras de cada deploy como endereco de login:
somente o callback do alias estavel esta autorizado.

## Interface

### Fluxo inicial do aluno e assistente (implementacao local)

No primeiro acesso sem uma apresentacao concluida, o app oferece um questionario
opcional de objetivo, experiencia, dias, duracao, equipamentos e limitacoes.
Contas existentes tambem recebem esta apresentacao uma vez. E possivel pular
e montar uma ficha manual. O estado `completed` ou `skipped` fica privado no
Supabase, por aluno, e so e mostrado como concluido apos confirmacao do servidor.

O questionario reutiliza Avaliacoes e Anamnese, sem exigir exames ou medidas.
Com consentimento especifico, o objetivo e a rotina sao armazenados no Supabase.
O app monta uma sugestao deterministica no proprio aparelho usando o catalogo
localmente consultado, sem enviar a avaliacao a um modelo generativo. Limitacoes,
reabilitacao ou orientacoes profissionais interrompem a sugestao automatica e
pedem avaliacao profissional. O aluno revisa e confirma antes de salvar as fichas
em uma operacao atomica; a biblioteca permite edita-las depois.

O painel inclui um guia local, que nao e uma IA conversacional. Ele oferece
orientacoes gerais de seguranca, acesso a fichas e demonstracoes. Sem video
cadastrado, **Buscar execucao no YouTube** abre uma busca externa pelo nome do
exercicio; os resultados nao sao revisados pelo app. O YouTube so recebe esse
nome quando o aluno abre a busca. Nao baixamos nem copiamos videos.

A IA generativa externa permanece desativada por decisao do responsavel. As
funcoes Gemini existentes continuam protegidas por configuracao de servico pago,
revisao de privacidade e consentimentos especificos; nao ativar a cota gratuita
para mensagens ou dados de alunos. Nenhuma migracao, funcao, politica publica ou
versao web desta etapa foi aplicada ou publicada automaticamente.

Antes de publicar este fluxo:

1. Aplicar, em ordem, as migracoes existentes e
   `supabase/migrations/202611030001_student_onboarding.sql`. Ela cria o estado
   privado da apresentacao e a funcao atomica de salvamento das sugestoes locais.
2. Atualizar a politica publica a partir de `public-site/privacy.html`; o
   arquivo local nao publica a politica automaticamente.
3. Homologar com dados sinteticos e conta descartavel. Nao aplicar migracoes,
   publicar a politica ou enviar uma versao web sem autorizacao.

Identidade visual MAROMBAFIT com temas claro e escuro, acentos azuis/lilas sem verde, acesso por
e-mail e senha com cadastro e recuperacao de senha, e painel de treino mobile-first. As barras de progresso usam a meta de
series por exercicio; series extras continuam contabilizadas no volume, sem
ultrapassar 100% da meta. Historico e contadores mostram apenas dados recebidos
do servidor, sem estatisticas ou funcionalidades de IA simuladas.
O nome cadastrado para distribuicao permanece configurado em `app.json`.

O seletor "Aparencia", disponivel no acesso e no painel de treino, permite
escolher Claro ou Escuro sem sair da conta. O padrao e claro. A escolha fica
salva neste aparelho (SecureStore no Android/iOS e localStorage na web) e
permanece ao reabrir o app; nao e sincronizada com outros aparelhos.
Trocar o tema nao reinicia o treino, o rascunho ou o cronometro.
Falhas de leitura/gravacao da preferencia aparecem junto ao seletor;
se a gravacao falhar, o tema continua aplicado na sessao atual e pode ser
selecionado novamente para tentar salvar. A barra de status nativa e a
navegacao acompanham o tema. As cores de texto das duas paletas sao testadas
com contraste minimo de 4,5:1 sobre os fundos usados pelo aplicativo.

A foto local `Fundo.jpg`, fornecida para uso no app, preenche o fundo inteiro
das telas de acesso e treino, inclusive fora da coluna central. O recorte
usa cover, sem distorcer a foto, e permanece atras do conteudo durante a
rolagem. Uma sobreposicao clara ou escura acompanha o tema. Os cartoes
ficam sobre fundos solidos para preservar a leitura. A imagem e empacotada com o app,
sem dependencia de servidores externos para carrega-la.

## Executar

### Minha evolucao

O painel mostra graficos de barras de carga por exercicio e frequencia semanal,
com filtros de 30 dias, 90 dias ou todo o historico e por ficha/exercicio.
Somente sessoes concluidas com pelo menos uma serie ou registro de cardio
entram no calculo; fichas arquivadas e exercicios removidos preservam sua
contribuicao historica. Cardio conta na frequencia, mas nao no grafico de carga.

Cada barra de carga corresponde a uma sessao: mostra a maior carga registrada
em uma serie daquele exercicio e as repeticoes dessa mesma serie. Em empate de
carga, usa a serie com mais repeticoes. Zero kg e um registro valido, nao dado
ausente. Exercicios com o mesmo identificador de catalogo sao comparados entre
fichas; registros legados sem catalogo permanecem separados pelo identificador
do exercicio. Datas seguem a ordem das sessoes, sem espacamento temporal
proporcional. Toque nas barras para ver data, ficha, carga e repeticoes.

Semanas comecam na segunda-feira no fuso do aparelho e incluem semanas com
zero treinos. O periodo e uma janela movel de dias no servidor; as semanas nas
bordas podem estar incompletas. Periodos vazios e um unico registro recebem
orientacao, sem criar dados simulados. Erros exibem uma tentativa de recarga.
Concluir um treino atualiza a evolucao; tambem ha o botao "Atualizar evolucao".
Maior carga nao e, isoladamente, evidencia de melhor execucao ou recomendacao
para aumentar pesos. Volume e evolucao de distancia/cardio nao fazem parte
desta primeira etapa.

Aplique uma unica vez `supabase/migrations/202610230003_workout_progress.sql`
antes de publicar esta interface. A RPC `get_workout_progress` exige
autenticacao, usa `auth.uid()` e RLS e aceita somente 30, 90 ou null (historico
completo). Ela agrega as series no servidor, sem o limite de dez sessoes do
historico resumido do painel.
A migracao foi aplicada no projeto hospedado em 23/10/2026, com acesso
anonimo bloqueado e execucao no contexto do aluno autenticado.

```powershell
npm start
```

Abra o QR code em um ambiente Expo compativel com o SDK do projeto ou use
um emulador Android. A primeira tela permite montar uma ficha pessoal antes de
exibir exercicios; a biblioteca inclui registro e remocao de series, volume e
descanso configuravel entre 5 e 600 segundos.
O timer usa um prazo absoluto para se atualizar ao retornar do segundo plano;
nao ha notificacao ou execucao garantida em segundo plano.

O app usa login por e-mail e senha, cadastro e recuperacao de senha, alem de persistencia de series no Supabase.
Esses fluxos dependem das migracoes e da configuracao abaixo; nao funcionam
apenas com a criacao de um projeto Supabase. A ficha inicial fica vazia;
exercicios aparecem somente nas fichas selecionadas pelo aluno. A sessao ativa e recuperada ao entrar novamente;
alteracoes exigem internet e confirmacao do servidor. O descanso continua local.

## Configuracao mobile e publicacao

Paginas publicas aprovadas pelo responsavel:

- Politica: https://samukajr.github.io/marombafit-privacy/privacy.html
- Exclusao externa: https://samukajr.github.io/marombafit-privacy/delete-account.html
- Repositorio separado: https://github.com/Samukajr/marombafit-privacy

As fontes ficam em `public-site/`. Publicar somente esses arquivos no repositorio
publico; nunca copiar `.env.local`, tokens ou o codigo privado do aplicativo.
Mudancas locais nessas paginas nao sao publicadas automaticamente.

- Configure `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  e `EXPO_PUBLIC_PRIVACY_POLICY_URL` em `.env.local` (ignorado pelo Git).
- Aplique as migracoes em ordem, incluindo
  `supabase/migrations/202610150001_mobile_workouts.sql` e
  `supabase/migrations/202610160001_workout_library.sql`,
  `supabase/migrations/202610160002_assessment_intake.sql` e
  `supabase/migrations/202610160003_gemini_assessments.sql` e
  `supabase/migrations/202610190001_account_deletion_storage.sql` e
  `supabase/migrations/202610220001_expand_exercise_catalog.sql` e
  `supabase/migrations/202610220002_ai_workout_plans.sql` e
  `supabase/migrations/202610220003_workout_management.sql` e
  `supabase/migrations/202610220004_exercise_demonstrations.sql` e
  `supabase/migrations/202610230001_empty_starter_workouts.sql`.
  Antes de aplicar, confirme quais objetos ja existem no projeto remoto. As
  migracoes anteriores de treino, biblioteca, avaliacoes e exclusao de conta
  foram aplicadas no projeto hospedado apos confirmar que estavam ausentes.
  O catalogo remoto tinha 55 exercicios em nove grupos e as tres novas tabelas
  de avaliacoes usam RLS. A migracao de exclusao de conta corrige a ambiguidade
  com `storage.objects.owner_id`.
  A migracao `202610220001_expand_exercise_catalog.sql` adiciona exercicios e
  subgrupos musculares sem apagar fichas ou historicos. A migracao
  `202610220002_ai_workout_plans.sql` adiciona propostas privadas e salvamento
  atomico, mas nao ativa a integracao Gemini; mantenha-a desativada ate a
  aprovacao dos termos do provedor. A migracao
  `202610220003_workout_management.sql` permite editar, arquivar e restaurar
  fichas manuais, preserva os registros historicos e impede editar uma ficha
  com treino em andamento que ja tenha registros. A migracao
  `202610220004_exercise_demonstrations.sql` adiciona um catalogo somente de
  leitura para videos aprovados, com credito, licenca e URLs HTTPS permitidas
  do YouTube ou Vimeo. A migracao `202610230001_empty_starter_workouts.sql`
  oculta os exercicios de exemplo das fichas iniciais e cria fichas iniciais
  vazias para novos alunos. A aplicacao e manual por SQL neste projeto; nao presuma
  que o historico automatico do CLI esteja preenchido nem use `db push` sem
  verificar os objetos remotos. As migracoes sao transacionais e cada uma deve
  ser aplicada somente uma vez.
  Em 22/10/2026, as migracoes 220001 e 220003 foram aplicadas e verificadas no
  projeto hospedado; o catalogo passou a 119 exercicios em 15 grupos. A ficha
  manual agora pode ser editada, arquivada e restaurada pela interface web.
  A migracao 220004 tambem foi aplicada; ela nao inclui videos automaticamente.
  A migracao 230001 removeu os exercicios de exemplo das fichas iniciais
  existentes, mantendo inalterados os registros historicos, e passou a criar
  fichas iniciais vazias para novos alunos.
  A migracao `202610230002_default_manual_workout.sql` faz o acesso inicial
  abrir a ficha manual ativa mais recente, em vez do exemplo vazio. Sem fichas
  manuais ativas, o painel orienta montar a primeira ficha. Na biblioteca,
  "Montar treino de corpo inteiro" abre o editor com esse nome e todos os
  grupos disponiveis, sem selecionar exercicios automaticamente; salvar cria
  uma ficha manual independente que pode ser editada e arquivada.
- Demonstracoes aprovadas aparecem na ficha de treino e na biblioteca, com
  credito/licenca e abertura do provedor fora do app. Nenhum video de terceiros
  e adicionado automaticamente; cadastre somente conteudo proprio ou autorizado
  apos revisar a execucao e a licenca. A tabela `exercise_demonstrations` so
  pode ser alterada por administradores e e legivel por usuarios autenticados.
  Ainda nao ha videos cadastrados no catalogo.
- Em Supabase Auth, habilite o provedor Email. O app usa senha nos acessos
  normais; pode enviar um e-mail para confirmar um cadastro (se a confirmacao
  estiver habilitada) ou para redefinir uma senha solicitada pelo usuario.
  Mantenha os templates padrao com `{{ .ConfirmationURL }}`. O app valida a
  sessao no retorno e remove os tokens da URL web, sem registra-los em logs.
- Em Authentication > URL Configuration > Redirect URLs, permita os destinos
  exatos `http://localhost:8097/auth/callback`, `marombafit://auth/callback` e
  `https://marombafit-samukajr82.expo.app/auth/callback`.
  Os tres destinos foram configurados no projeto de teste; Site URL agora e
  `https://marombafit-samukajr82.expo.app`. Outros enderecos
  web precisam de sua propria entrada antes do uso. Links antigos enviados
  para localhost:3000 nao sao corrigidos: solicite um novo pelo app.
- Confirme cadastro ou redefina senha no mesmo navegador usado para o app. O
  armazenamento web e por aba: se o e-mail abrir uma nova aba, a sessao fica
  nessa nova aba. No celular, use o mesmo navegador para o link web. O scheme
  `marombafit` aplica-se somente a versao nativa instalada; nao e um link de
  instalacao e nao garante funcionamento no Expo Go.
- O envio padrao do Supabase tem restricoes de destinatarios e limites;
  configure SMTP proprio para confirmacoes e recuperacoes destinadas a usuarios
  reais. O template `supabase/templates/email-code.html` e um artefato da
  alternativa por codigo; nao o aplique ao fluxo atual.
- Publique `delete-account` com `supabase functions deploy delete-account`.
  A funcao valida a identidade, remove arquivos privados do usuario e depois
  exclui a conta e seus registros. Uma falha parcial e informada e permite repetir.
  Publicada e validada pela interface hospedada em 19/10/2026 com conta
  descartavel; os registros de treino e avaliacao foram removidos.
- Mantenha a politica de privacidade e a pagina externa de solicitacao de
  exclusao de conta publicadas e consistentes com os dados tratados e requisitos
  aplicaveis do Google Play.
- Configure as mesmas variaveis nos ambientes EAS `preview` e `production`.
  A autorizacao Supabase do VS Code nao configura automaticamente o EAS.

O projeto esta vinculado a `@samukajr82/fitness-ai-app`. O identificador nativo
e `com.samukajr82.marombafit`. `eas.json` define APK interno em `preview` e
builds para as lojas em `production`, com versoes incrementadas pelo EAS.
Os hooks bloqueiam builds sem variaveis obrigatorias e executam validacoes.

```powershell
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

Os comandos de build/submissao ainda exigem configuracao de assinatura e contas
Apple Developer e Google Play Console. Nao foram gerados binarios nem feita
publicacao nas lojas. A versao web ja esta online no endereco acima.
Antes de submeter, valide em aparelhos reais: link por e-mail,
reabertura da sessao, registro/remocao de series, historico e exclusao de conta.
Prepare screenshots, suporte, politica de privacidade, declaracoes de dados
e acesso para revisao. Os requisitos de teste das lojas dependem da sua conta.

Para retomar o teste local, execute `npm run web -- --port 8097` e abra
http://localhost:8097/login. Esse endereco so funciona no computador com o
servidor ativo; nao e hospedagem publica nem um instalador Android/iPhone.

Para autorizar a publicacao de funcoes a partir deste computador, execute no
terminal interativo `npx supabase login` e conclua a autorizacao no navegador.
Nao envie o token para o chat nem salve em arquivos versionados. Depois:

```powershell
npx supabase functions deploy delete-account --project-ref rbytaifqlonrvlntuyva --use-api
```

`--use-api` dispensa Docker. Nao desabilite a verificacao JWT para contornar
erros de autenticacao. Teste exclusao apenas com conta descartavel autorizada,
nao com a conta principal do responsavel.

## Estrutura implementada

### Biblioteca e fichas manuais

O catalogo, ampliado pela migracao `202610220001_expand_exercise_catalog.sql`,
oferece mais de 100 exercicios para membros superiores, membros inferiores,
core e cardio. Na montagem da ficha, escolha primeiro a area e depois o grupo
muscular: peito, costas, ombros, biceps, triceps,
trapezio, antebracos, quadriceps, posterior de coxa, gluteos, adutores,
abdutores, panturrilhas, abdomen ou cardio (bike, esteira, caminhada, corrida,
eliptico, remo, escada e corda).
Em "Minhas fichas", crie uma ficha com nome e
1 a 30 exercicios distintos, filtre por grupo/equipamento, ordene os itens e
defina series, repeticoes e descanso ou minutos de cardio.
Nao ha metas prescritas automaticamente: preencha com orientacao profissional.
O descanso planejado aparece no exercicio; o cronometro e o descanso registrado
na serie usam o valor ajustavel da tela.

As fichas salvas podem ser selecionadas, mas ainda nao editadas ou excluidas.
O rascunho nao salvo e descartado ao fechar a biblioteca ou trocar de ficha.
Cada ficha retoma sua sessao ativa e mostra seus ultimos dez treinos concluidos.
Ao reabrir o aplicativo, a entrada continua sendo a ficha demonstrativa;
selecione sua ficha na biblioteca para retoma-la.

Cardio registra minutos inteiros (1 a 600), distancia opcional em km (0 a 1000,
ate duas casas decimais) e esforco percebido (1 a 10).
Distancia vazia e diferente de zero. Fichas apenas de cardio podem ser
concluidas e seu historico apresenta minutos, sem exigir series de musculacao.
RLS e chaves compostas limitam fichas e registros ao usuario autenticado.
Uma falha de confirmacao exige atualizar os dados antes de repetir o registro.

A leitura opcional de documentos e a proposta de treinos por IA estao
implementadas localmente, mas permanecem desativadas no servidor. Exigem
consentimentos separados, confirmacao de 18 anos, revisao humana das leituras
e aprovacao explicita antes de salvar propostas. Nao sao avaliacao clinica,
diagnostico ou liberacao profissional. Nao inclua documentos pessoais de saude
em commits, builds ou dados de exemplo.

### Modulos

- `src/features/workouts`: tela, componentes, tipos e validacao de series.
- `src/theme`: cores compartilhadas.
- `src/lib/supabase`: cliente configurado sob demanda.
- `src/services/aiService.ts`: contrato mobile para analise de refeicoes.
- `supabase/functions`: endpoint de IA e contrato validado compartilhado.
- `supabase/migrations`: esquema inicial, RLS e buckets privados.

Os demais modulos da arquitetura proposta serao criados conforme implementados,
sem arquivos vazios ou telas que simulem integracoes prontas.

## Etapa A - Supabase

Execute o conteudo de `supabase/migrations/202610140001_initial_schema.sql`
no SQL Editor de um projeto Supabase novo. A migracao e transacional, mas nao
e idempotente: aplique apenas uma vez, ou use o historico de migracoes da CLI.

Tabelas: profiles, workouts, exercises, food_logs e health_reports.
workout_sessions e workout_sets separam a ficha planejada do historico executado.
As chaves compostas impedem associar exercicios e series a treinos de outro dono.
O nome do exercicio e copiado para o registro historico; exclusoes de fichas e
exercicios com historico sao bloqueadas por integridade referencial.

O cadastro no Supabase Auth cria automaticamente o perfil. RLS limita cada
usuario aos seus registros. Arquivos privados usam caminhos
`<user-id>/<nome-do-arquivo>` nos buckets meal-images e health-reports.
Excluir um registro nao exclui automaticamente o objeto do Storage.
O fluxo de exclusao de conta remove os arquivos privados e dados ativos; consulte
a politica publica para limites de retencao em backups e logs de fornecedores.

## Etapa B - IA de refeicoes

1. Copie `.env.example` para `.env` e preencha a URL e a chave publicavel.
2. Configure OPENAI_API_KEY e OPENAI_VISION_MODEL como secrets de Edge Functions
   no Supabase. O modelo escolhido deve suportar imagens e JSON Schema estrito.
   `supabase/.env.example` documenta as variaveis exclusivas do servidor.
3. Publique `analyze-meal` usando a CLI Supabase vinculada ao seu projeto:

```powershell
supabase functions deploy analyze-meal
```

4. Depois de autenticar um usuario pelo mesmo cliente Supabase, chame
   `analyzeMeal(base64, 'image/jpeg')`. Envie base64 puro, sem prefixo data:.
   A sessao e armazenada com Expo SecureStore em Android/iOS e sessionStorage
   na web. No mobile, tokens longos sao divididos em partes para armazenamento.

Retorno validado:

```json
{
  "meal_name": "Arroz, feijao e frango",
  "calories": 520,
  "proteins_g": 38,
  "carbs_g": 60,
  "fats_g": 14
}
```

O app nunca recebe a chave OpenAI. O endpoint valida a identidade, limita o
tamanho da entrada e trata recusa, timeout e resposta invalida explicitamente.
Os resultados sao estimativas que exigem revisao humana; nao sao salvos
automaticamente em food_logs. Nao ha tela de camera/upload nesta entrega.

Antes de expor a funcao a usuarios reais, implemente cotas por usuario,
rate limiting e controle de custos no backend. Autenticacao sozinha nao limita
consumo. Configure limites financeiros no provedor durante desenvolvimento.

## Avaliacoes, anamnese e documentos privados

Em "Minhas avaliacoes e anamnese", registre objetivo, experiencia,
disponibilidade, equipamentos, limitacoes e orientacoes profissionais.
Peso, altura, gordura e massa muscular sao opcionais: nao estime valores
ausentes. Os limites dos campos sao tecnicos, nao referencias clinicas.
O armazenamento exige consentimento especifico, diferente do consentimento de IA.
Cada avaliacao salva e um registro historico imutavel; novas medicoes
devem ser salvas em nova avaliacao. A lista mostra as dez mais recentes.

Cada registro aceita ate cinco PDFs/JPEGs/PNGs de ate 10 MB, em bucket privado.
O envio tem etapas de preparacao, upload sem sobrescrita e confirmacao.
Se houver falha, atualize a lista e use "Verificar envio" antes de repetir.
A remocao exige confirmacao e apaga arquivo antes do registro e da transcricao.
Na plataforma nativa, a copia temporaria criada pelo seletor e removida;
o documento original permanece no aparelho.

## Google Gemini: leitura e propostas de treino

O codigo local amplia `analyze-assessment` com duas acoes separadas:
**transcrever medidas** de um documento privado confirmado e **propor fichas
de treino** com base na avaliacao selecionada, disponibilidade, experiencia,
equipamentos, limitacoes informadas e medidas de documentos que o usuario
conferiu e selecionou. A chave Gemini permanece no servidor.

Cada acao exige confirmacao de 18 anos e consentimento explicito proprio,
separado do consentimento para armazenar a avaliacao. A proposta pode criar
uma ficha por dia disponivel (por exemplo, peito/triceps, costas/biceps e
pernas/ombros), usando somente exercicios de forca do catalogo. Series,
repeticoes e descanso ficam limitados; a IA nao define cargas. O usuario ve a
divisao e precisa confirmar antes de salvar todas as fichas em uma operacao
atomica. O backend limita a duas tentativas de geracao por usuario por dia UTC.

Esta e uma proposta geral de condicionamento, nao uma interpretacao medica:
a IA nao diagnostica, nao interpreta clinicamente valores de exames, nao libera
atividade e nao substitui profissional. Medidas de exames sao enviadas somente
apos conferencia e selecao, mas nao devem determinar cargas ou seguranca.
Sinais de risco explicitos interrompem a geracao; os demais dados informados
podem gerar alertas e limitacoes. Confirme a adequacao com profissional
habilitado. A saida estruturada e validada contra o catalogo; resposta
incompleta ou invalida e recusada, nao salva como sucesso.

### Geracao por objetivo e rota dedicada

Os objetivos `hypertrophy` (hipertrofia) e `weight_loss` (emagrecimento)
organizam propostas gerais de forca. Emagrecimento nao inclui dieta,
deficit calorico ou promessa de perda de peso. Os objetivos anteriores
continuam aceitos, preservando o historico.

`rehabilitation` (reabilitacao/fisioterapia) sempre retorna
`professional_review`, com motivos e sem exercicios, sem chamar o Gemini.
Esse fluxo nao gera prescricao terapeutica, mesmo quando ha relato de
liberacao: e necessaria avaliacao de profissional habilitado.

Anamnese inclui objetivo, experiencia, disponibilidade, equipamentos,
limitacoes e orientacoes profissionais. Bioimpedancia inclui data, peso,
altura, percentual de gordura e massa muscular informados, alem das medidas
extraidas de documentos selecionados e conferidos. Valores ausentes continuam
`null`; nao ha interpretacao clinica nem calculo automatico de intensidade.
Arquivos originais, nomes de anexos e identificadores do aluno nao entram
no pedido de geracao. Nao registre dados de saude em logs.

- Tipos compartilhados: `src/features/workouts/ai-types.ts`.
- Integracao Gemini: `supabase/functions/_shared/workout-generation.ts`,
  com timeout de 60 segundos e validacao da saida contra o catalogo.
- API autenticada: `POST /functions/v1/generate-workout-plan`.
  A acao legada `generate_workout_plan` de `analyze-assessment` continua aceita,
  com a mesma validacao, consentimento e quota compartilhada.

Corpo (identificadores apenas ilustrativos):

```json
{
  "assessment_id": "22222222-2222-4222-8222-222222222222",
  "document_ids": [],
  "adult_confirmed": true,
  "consent_version": "gemini-workout-v1"
}
```

Envie `Authorization: Bearer <JWT do aluno>` e a chave publica Supabase em
`apikey`. A avaliacao e os documentos sao carregados pelo servidor e precisam
pertencer ao usuario autenticado; nao envie anamnese arbitraria no corpo.
`document_ids` aceita ate cinco documentos, sem duplicatas; cada transcricao
precisa de conferencia humana registrada. Lista vazia usa apenas a anamnese
e as medidas preenchidas. `{"action":"status"}` consulta disponibilidade.

Sucesso retorna `{ generationId, plan }`: `plan.status` sera `ready`
(titulo, avisos e fichas) ou `professional_review` (titulo e motivos, sem
fichas). Isso nao representa aprovacao clinica. Erros retornam `{ error }`:
400 para entrada invalida, 401 para sessao ausente/invalida, 405 para metodo,
409 para recusa de autorizacao/quota, 413 para corpo acima de 2048 bytes,
502 para falha de geracao/persistencia e 503 para servico desativado.

Em um novo ambiente, antes de publicar o cliente, aplique
`supabase/migrations/202610290001_workout_generation.sql`, apos as migracoes
anteriores, e publique **ambas** as funcoes. No projeto existente, confira
os objetos e o historico antes de aplicar qualquer SQL: migracoes antigas
foram executadas manualmente e nao estao todas registradas no historico CLI.
Nao execute `db push` indiscriminadamente nesse projeto.

```powershell
npx supabase migration list --linked
# Somente se a migracao ainda nao estiver aplicada e os pre-requisitos existirem:
npx supabase db query --linked --file .\supabase\migrations\202610290001_workout_generation.sql
npx supabase migration repair 202610290001 --status applied --linked
npx supabase functions deploy analyze-assessment --project-ref rbytaifqlonrvlntuyva --use-api
npx supabase functions deploy generate-workout-plan --project-ref rbytaifqlonrvlntuyva --use-api
```

Nenhuma migracao ou publicacao remota e executada automaticamente pelo
aplicativo. As flags de privacidade, servico pago, chave/modelo e ativacao
`GEMINI_WORKOUTS_ENABLED` continuam obrigatorias e desativadas por padrao.

**Publicacao verificada em 29/10/2026:** apos conferir o esquema remoto,
foram aplicadas e registradas somente as migracoes ausentes
`202610220002_ai_workout_plans.sql` e `202610290001_workout_generation.sql`.
O catalogo expandido e as demais estruturas necessarias ja existiam.
O historico CLI anterior permanece incompleto; regulariza-lo exige uma
conferencia separada, sem reaplicar SQL ou marcar migracoes por suposicao.
`analyze-assessment` versao 13 e `generate-workout-plan` versao 1 estao ACTIVE
com verificacao JWT. O lint SQL remoto nao encontrou erros.

A SPA foi publicada no alias estavel indicado no inicio deste documento.
`/login` e `/auth/callback` responderam HTTP 200 e o hash SHA-256 do JavaScript
remoto coincidiu com o da exportacao local validada. A tela de acesso tambem
foi conferida no navegador. Nao foi gerado APK/IPA nem publicado nas lojas.

Release check, TypeScript, lint e os 79 testes locais passaram. Testes remotos
com conta descartavel confirmaram autenticacao obrigatoria (401), os tres
objetivos persistidos, geracao desativada (503), permissoes das RPCs,
salvamento idempotente do plano sintetico validado e rejeicao de fichas
adulteradas ou de revisao profissional. A conta, avaliacoes, tentativas,
fichas e exercicios sinteticos foram removidos ao final.
As duas rotas confirmaram leitura e geracao Gemini desativadas.
Nenhum exame real nem dado sintetico desse teste foi enviado ao Gemini;
nenhuma flag de ativacao ou chave de provedor foi alterada nesta publicacao.

O resultado validado fica privado em `workout_ai_attempts.generated_plan`.
A RPC `create_ai_workout_plan` salva atomicamente somente fichas identicas
ao plano `ready` registrado no servidor e preserva idempotencia. Nao aceita
salvar uma resposta de revisao profissional nem fichas alteradas pelo cliente.
Propostas antigas ainda nao salvas, geradas antes desta migracao, devem ser
geradas novamente; fichas ja salvas nao sao modificadas.

### Conta Google e custos: configuracao assistida

1. Entre pessoalmente em https://aistudio.google.com/projects com a conta
   Google responsavel pelo MAROMBAFIT. Crie/importe um projeto dedicado.
2. Em "Set up billing", confira pais, dados e metodo de pagamento e aceite
   os termos pessoalmente. Nao compartilhe senha, cartao ou codigos.
   A documentacao atual informa pre-pagamento minimo de US$ 5 ou equivalente
   para novas contas; confirme o valor e as opcoes exibidas antes de pagar.
   Se houver opcao Prepay, prefira iniciar sem recarga automatica.
   Nunca use o Free Tier para documentos sensiveis de saude.
3. Confirme o status pago do projeto em https://aistudio.google.com/billing.
   Um projeto existente ou uma chave criada nao comprovam faturamento ativo.
   A disponibilidade de Prepay/Postpay e os precos dependem da sua conta.
4. Consulte precos em https://ai.google.dev/gemini-api/docs/pricing e cotas
   em https://aistudio.google.com/rate-limit. Comece com um modelo economico
   que suporte PDF, imagens e JSON Schema, disponivel no seu projeto.
   Configure alertas de orcamento e cotas baixas. Alertas nao sao teto de gastos;
   cotas por usuario tambem nao limitam o total monetario do projeto.
5. Crie uma chave em https://aistudio.google.com/api-keys no MESMO projeto
   pago. Use chave de autorizacao/restrita a Generative Language API,
   conforme as opcoes atuais do Google. Nao coloque a chave no chat,
   frontend, repositorio ou variaveis EXPO_PUBLIC_.
6. No painel Supabase, em Edge Functions > Secrets, cadastre `GEMINI_API_KEY`
   diretamente. Cadastre `GEMINI_MODEL` com o identificador exato escolhido.
   Mantenha os indicadores de leitura/geracao, faturamento e privacidade abaixo
   como `false` ate concluir as revisoes correspondentes.

### Ativacao somente apos revisao

Os placeholders estao em `supabase/.env.example`. No servidor:

```text
GEMINI_API_KEY=<cadastrar diretamente em Secrets, nunca no chat>
GEMINI_MODEL=<modelo confirmado na conta paga>
GEMINI_REPORTS_ENABLED=false
# Ativar separadamente, somente apos aprovar e validar este fluxo.
GEMINI_WORKOUTS_ENABLED=false
GEMINI_PAID_SERVICE_CONFIRMED=false
GEMINI_PRIVACY_REVIEWED=false
# UUID de conta descartavel para homologacao, ou vazio para disponibilidade geral.
GEMINI_REPORTS_TEST_USER_ID=
```

Depois de aplicar as oito migracoes, autorizar o Supabase CLI e cadastrar
os secrets, publique sem desabilitar verificacao JWT:

```powershell
npx supabase functions deploy analyze-assessment --project-ref rbytaifqlonrvlntuyva --use-api
```

Antes de ativar leitura ou geracao, revise e publique as paginas atualizadas de
`public-site/privacy.html` e `public-site/delete-account.html` no repositorio
publico separado. A edicao local nao altera as paginas publicadas. Isso deve
preceder qualquer envio de dados de saude a um provedor de IA. O texto preparado
nao substitui revisao juridica de LGPD, transferencia internacional e termos
para dados de saude. Configure comunicacao do publico 18+ em todo o produto.
As condicoes atuais da Gemini API descrevem o uso como destinado a fins
profissionais/comerciais, nao a uso do consumidor, e proíbem uso para prestar
orientacao medica ou em contexto que exija autorizacao regulatoria de dispositivo
medico. Como o FitVision e voltado a atletas/consumidores e recebe contexto de
saude, nao habilite o Gemini neste produto sem confirmar formalmente com o Google
que este caso de uso e permitido e sem concluir a revisao juridica; considere
um provedor/contrato adequado se nao houver confirmacao. Uma conta paga, por si
so, nao resolve essa restricao.
Confirme conta paga ativa, contratos/condicoes dos fornecedores e teste
primeiro com documento sintetico sem dados pessoais.
Nao altere `GEMINI_PAID_SERVICE_CONFIRMED` sem efetivamente confirmar billing:
o indicador e uma declaracao operacional do responsavel, nao verifica billing
automaticamente no Google. Se o projeto voltar ao Free Tier, desative o fluxo.
Para homologacao, defina `GEMINI_REPORTS_TEST_USER_ID` com o UUID da conta
descartavel antes de habilitar os indicadores. Outras contas continuarao
bloqueadas, inclusive na consulta de disponibilidade. A acao operacional
`models` da funcao lista nomes disponiveis no provedor somente para essa
conta explicitamente configurada; ela nao expoe chaves nem recebe documentos.
No fim do teste, desative os indicadores antes de excluir a conta de teste.
Nao remova a restricao de conta sem aprovar explicitamente a liberacao real.

No app, "Verificar disponibilidade do Gemini" consulta o servidor sem enviar
documentos. Funcao nao publicada/configurada mostra erro, nao sucesso simulado.
Os botoes de leitura e geracao so sao liberados apos disponibilidade confirmada.
Cada documento e cada geracao exigem consentimentos separados. O servidor impoe
tres tentativas de leitura e duas de geracao por usuario por dia UTC, com
intervalo de um minuto e reserva atomica. Remover um anexo nao zera a cota.
Documentos selecionados devem estar transcritos e conferidos; a chamada de
geracao envia os dados da avaliacao e as medidas selecionadas, nao os arquivos.
Leituras em andamento bloqueiam repeticao por cinco minutos; a chamada
ao provedor tem timeout de 60 segundos. Atualize a lista para recuperar
resultados apos falha de rede. Nao ha fila ou processamento em segundo plano.

A integracao usa REST `generateContent`, ainda suportada pelo Google,
com documento inline, sem Files API ou sessao persistente da Interactions API.
Isso nao representa retencao zero: termos pagos preveem registros limitados
para seguranca. Conteudos e chaves nao sao enviados aos logs pelo codigo.
`analyze-meal` continua separado usando OpenAI; nao foi migrado silenciosamente.

**Estado atual (19/10/2026):** migracoes pendentes aplicadas no projeto remoto,
politica de privacidade revisada tecnicamente e publicada na URL oficial,
e `GEMINI_MODEL=gemini-3.1-flash-lite` confirmado disponivel pela API e
validado com uma chamada real usando PDF inteiramente ficticio. O modelo
inicial gemini-2.5-flash retornou HTTP 404 nas tentativas; a disponibilidade
foi consultada antes de selecionar e testar o novo modelo. Nao ha troca
silenciosa de modelo em producao.

O teste autenticou duas contas descartaveis, salvou anamnese, enviou PDF privado,
comprovou isolamento entre contas, transcreveu tres valores ficticios com pagina
e origem, confirmou conferencia explicita e verificou que medidas manuais nao
foram sobrescritas. A transcricao, arquivo e contas de teste foram removidos;
as tabelas de avaliacao e tentativas ficaram sem registros dessas contas.
A chave Gemini permaneceu no Supabase, sem ser copiada ao chat ou cliente.
Nenhum exame real do usuario foi enviado ao Google.

A funcao publicada esta ACTIVE com verificacao JWT; sem autenticacao retorna 401.
Ao final da homologacao, os indicadores foram restaurados para `false`
e a restricao de conta foi definida para um UUID sentinela sem usuario.
O modelo permanece configurado, mas leitura de documentos reais continua
desativada. Liberacao real exige aprovacao operacional, verificacao de custos,
condicoes de tratamento de dados e revisao juridica aplicavel. Publicar
um texto de privacidade nao constitui certificacao de conformidade LGPD.

**Estado historico em 22/10/2026 (superado pela publicacao de 29/10 acima):** o codigo local inclui proposta
multificha de treino e consentimento separado, mas as migracoes
`202610220001_expand_exercise_catalog.sql` e
`202610220002_ai_workout_plans.sql`, a atualizacao de `analyze-assessment` e a
politica atualizada ainda precisam ser aplicadas/publicadas no Supabase e no
site publico. `GEMINI_WORKOUTS_ENABLED` permanece `false`; a funcionalidade nao
esta disponivel online ate concluir esses passos e homologar com dados
sinteticos e conta descartavel.

Nunca coloque service_role, OPENAI_API_KEY, GEMINI_API_KEY ou dados de exames em variaveis
EXPO_PUBLIC_*, logs ou controle de versao. Dados de saude exigem tratamento
compativel com a LGPD.

## Validacao

```powershell
npx tsc --noEmit
npx expo install --check
npm run lint
npm test
```

Os testes de logica usam o runner nativo do Node.js 24, sem dependencias extras.
O backend usa Deno e deve ser validado separadamente com
`deno check supabase/functions/analyze-meal/index.ts`,
`deno check supabase/functions/analyze-assessment/index.ts` e com Supabase de teste.
TypeScript mobile nao verifica as Edge Functions.
As vulnerabilidades de dependencias anteriormente reportadas nao foram
resolvidas por esta implementacao.
