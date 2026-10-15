# FitVision AI

Base mobile Expo SDK 57 + TypeScript para treinos, nutricao e avaliacoes.

## Executar

```powershell
npm start
```

Abra o QR code em um ambiente Expo compativel com o SDK do projeto ou use
um emulador Android. A primeira tela mostra um treino demonstrativo, registro
e remocao de series, volume total e descanso configuravel entre 5 e 600 segundos.
O timer usa um prazo absoluto para se atualizar ao retornar do segundo plano;
nao ha notificacao ou execucao garantida em segundo plano.

**Os registros de treino sao apenas em memoria. Fechar/recarregar o aplicativo
apaga a sessao.** Autenticacao e persistencia remota ainda nao estao conectadas
a interface. A ficha de exemplo nao e uma recomendacao personalizada.

## Estrutura implementada

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
Antes de producao, implemente exclusao de conta/arquivos e politica de retencao.

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
   A sessao atual fica apenas em memoria; persistencia segura de login sera
   implementada na etapa de autenticacao.

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

## PDFs e seguranca

Esta entrega prepara a tabela e o bucket de PDFs, **nao implementa a analise
de exames ou geracao de treinos por IA**. Essa etapa exige extracao validada,
consentimento, processamento assincrono e revisao das sugestoes.
O aplicativo nao substitui avaliacao medica ou orientacao profissional.

Nunca coloque service_role, OPENAI_API_KEY ou dados de exames em variaveis
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
`deno check supabase/functions/analyze-meal/index.ts` e com Supabase de teste.
TypeScript mobile nao verifica as Edge Functions.
As vulnerabilidades de dependencias anteriormente reportadas nao foram
resolvidas por esta implementacao.
