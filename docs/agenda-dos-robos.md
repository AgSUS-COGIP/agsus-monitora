# Agenda dos robôs (o banco pede ao GitHub)

O `schedule` do GitHub Actions, no plano gratuito, atrasa e pula execuções (em 06–07/10/2026 as
sincronizações de hora em hora rodaram a cada 5–8 h). Por isso **o banco é o único agendador**:
o pg_cron chama `private."FC_DISPARAR_ROBO"`, que pede a execução ao GitHub pela API
(`workflow_dispatch`, ramo `main`, `disparado_por = AGENDA`) com o pg_net. Os workflows não têm
mais `schedule`; continuam com o **Rodar agora** e o **Run workflow**.

O **Rodar agora**, as **Opções** e o **Recalcular** da pré-classificação também passam pelo banco
(RPC `disparar_robo`, que confere quem pede e as opções e chama o mesmo `FC_DISPARAR_ROBO` com
`disparado_por` = id de quem clicou): **uma chave só**, a do Vault. Funciona também no computador
(localhost). A antiga função `api/rodar-carga.js` saiu e a variável **`GITHUB_DISPATCH_TOKEN` da
Vercel pode ser apagada** (Vercel → projeto → Settings → Environment Variables).

Migration: `supabase/migrations/20261008140000_agenda_dos_robos_pelo_banco.sql` (ensaio e rollback
em `supabase/ensaios/` e `supabase/rollback/`).

## Horários (UTC = Brasília + 3 h)

Como está no `cron.job` do banco (conferido em 22/10/2026):

| Tarefa do pg_cron                    | Agenda (UTC)            | Brasília                                  | Ativa                 | Workflow                      |
| ------------------------------------ | ----------------------- | ----------------------------------------- | --------------------- | ----------------------------- |
| `agsus_robo_sincronizar_entrevistas` | `5 0-10,15,21-23 * * *` | aos :05, de 18h a 7h, às 12h05            | **não** (desde 16/10) | `sincronizar-entrevistas.yml` |
| `agsus_robo_sincronizar_selecao`     | `10 11,16,21 * * *`     | 8h10, 13h10 e 18h10                       | **não** (desde 16/10) | `sincronizar-selecao.yml`     |
| `agsus_robo_conferencias`            | `0 9 * * *`             | 6h                                        | sim                   | `conferencias.yml`            |
| `agsus_robo_conferir_disparos`       | `*/15 * * * *`          | a cada 15 min (lê as respostas do GitHub) | sim                   | —                             |

**Entrevistas e Seleção estão DESLIGADAS DE PROPÓSITO desde 16/10/2026** (`active = false`; o
último pedido `AGENDA` de cada uma em `TL_DISPARO_ROBO` é de 16/10, 7h05 e 8h10 de Brasília). As
duas tarefas continuam no `cron.job` com a agenda acima, para religar sem reescrever; até lá, as
cargas só rodam pelo **Rodar agora** (ou Run workflow). O Status das atualizações mostra as duas
como "desligada desde 16/10/2026: só pelo Rodar agora", sem prazo (não ficam "Atrasada"), e a
linha **Agenda dos robôs** passa a esperar só o pedido diário das Conferências (atrasada depois
de 26 h). Não religue sem combinar com a coordenação; ao religar, devolva também o "esperado" e o
prazo em `src/lib/saude-das-cargas.ts` (e o teste).

Robô da Empregare e pré-classificação estão na lista fixa da função; fora a agenda das inscrições
(abaixo), não têm agenda.

No banco em 22/10/2026: entrevistas com `5 0-10,15,21-23 * * *` e conferir disparos com
`*/15 * * * *` (as linhas acima são as da migration de origem); 21, 22 e 23 com `active = false`.

## Chaves da automação (20261022190000)

Ligar e desligar o que roda sozinho é pela tela **Configurações › Automação** (só administrador
global), com motivo e histórico — não mais com `cron.alter_job(..., active := ...)` à mão. Uma
chave por aba; desligada:

- as tarefas do pg_cron da chave ficam com `active = false` (a tela desliga e religa junto);
- `FC_DISPARAR_ROBO` não pede nada ao GitHub com origem `AGENDA` (vale mesmo se alguém religar a
  tarefa direto no banco; a tela avisa a tarefa fora do estado da chave);
- o **Rodar agora** do Status das atualizações continua, com confirmação; a linha mostra
  "Desligada pelo administrador" em vez de atraso;
- "Classificação em Python" (20261023170000): gerar uma lista não pede o relatório de desempate
  (`FC_PEDIR_DESEMPATE` confere a chave; o preparo fica `DESLIGADA`);
- "Gerar listas pelo Python" (20261023200000, **nasce desligada**): desligada, o "Gerar" calcula e
  registra na tela, como antes; ligada, pede `classificacao.yml` com `modo=calculo`
  (`pedir_calculo_classificacao`) e registra a lista do Python só igual à da tela. Sem a linha da
  chave, conta como desligada. **Só tem efeito com "Classificação em Python" também ligada**
  (20261024110000: o pedido sai pelo mesmo `classificacao.yml`); com ela desligada, o "Gerar" é o
  da tela e Configurações › Automação avisa que a chave está sem efeito.

| Chave                        | Tarefas do pg_cron                                                                                                                    | Workflow (agenda)                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Entrevistas                  | `agsus_robo_sincronizar_entrevistas`                                                                                                  | `sincronizar-entrevistas.yml`                                                 |
| Seleção                      | `agsus_robo_sincronizar_selecao`                                                                                                      | `sincronizar-selecao.yml`                                                     |
| KPIs do edital               | `agsus_kpis_do_edital_pela_selecao`                                                                                                   | —                                                                             |
| Robô de inscrições           | `agsus_robo_inscricoes_*`                                                                                                             | `robo-empregare.yml`                                                          |
| Pré-classificação automática | —                                                                                                                                     | `pre-classificacao.yml` chamado no fim do `robo-empregare.yml` (apos_robo)    |
| Conferências                 | `agsus_robo_conferencias`                                                                                                             | `conferencias.yml`                                                            |
| Pacotes dos painéis          | `agsus_analises_cache_do_painel`, `agsus_aprovados_cache_por_area`, `agsus_entrevistas_cache_do_painel`                               | —                                                                             |
| Manutenção do banco          | `agsus_analises_analyze_diario`, `agsus_fila_estatisticas`, `agsus_analises_encerrar_inativas`, `agsus_eventos_acesso_limpeza_mensal` | —                                                                             |
| Classificação em Python      | —                                                                                                                                     | `classificacao.yml` pedido ao gerar uma lista (20261023170000)                |
| Gerar listas pelo Python     | —                                                                                                                                     | `classificacao.yml` (modo calculo) pedido ao clicar em Gerar (20261023200000) |

Sem chave (sempre ligadas): `agsus_robo_conferir_disparos` (fecha os pedidos do Rodar agora) e
`agsus_inativar_listas_vencidas`. Fora do banco: os gatilhos do Apps Script das planilhas de
análises (incremental a cada 20 min) ficam no Google; a Leitura de arquivos só roda pelo Run
workflow. Os workflows dos robôs só têm `workflow_dispatch` (`tests/workflows-dos-robos.test.js`
impede `push` e `schedule`).

## Agenda das inscrições (robô da Empregare + pré-classificação)

Durante as inscrições de um edital, a coordenação acompanha inscritos e aptos no cartão
**Inscrições** da aba Pré-classificação (Aya: "Acompanhar inscrições"). Para os números andarem
sozinhos, uma tarefa do pg_cron pede o **robô da Empregare** do edital (`editais` = o número, modo
`normal`); no fim da carga, o próprio workflow roda a **pré-classificação** dos editais carregados
(`--apos-robo`), que grava o retrato diário das inscrições. Uma tarefa só faz as duas coisas.

A tarefa chama `private."FC_AGENDA_DAS_INSCRICOES"(tarefa, editais, até)`: até a data `até`
(Brasília) pede o robô por `FC_DISPARAR_ROBO`; no primeiro horário depois dela, **desliga a
própria tarefa** (`cron.unschedule`) e não pede nada. Migration:
`supabase/migrations/20261009140000_acompanhamento_das_inscricoes.sql` (ensaio e rollback em
`supabase/ensaios/` e `supabase/rollback/`).

Nenhuma tarefa de inscrições está agendada hoje. A do 114/2026 (`agsus_robo_inscricoes_114_2026`,
`0 10,16 * * *` = 7h e 13h, até 15/10/2026) ficou inativa no `cron.job` depois das inscrições e saiu
de vez em `supabase/migrations/20261022150000_remove_agenda_das_inscricoes_do_114.sql` (o rollback a
recria igual, inativa).

O robô só acha as vagas de um edital em inscrição se elas estiverem **ligadas ao edital** em
`TB_EMPREGARE_VAGA` (origem `ligada` em `listar_vagas_empregare`): o edital ainda não tem análise
curricular (de onde o quadro tira o código da vaga) nem Seleção. Ligue os códigos uma vez (para o
114/2026: `supabase/correcoes/20261009-edital-114-vagas-da-empregare.sql`) ou rode o robô uma vez
com `vagas` = os códigos depois de ligá-los.

**Outro edital** (SQL Editor, papel postgres; troque nome, edital e data):

```sql
select cron.schedule('agsus_robo_inscricoes_120_2026', '0 10,16 * * *',
  $$select private."FC_AGENDA_DAS_INSCRICOES"('agsus_robo_inscricoes_120_2026', '120/2026', date '2026-11-30');$$);
```

O nome tem de começar por `agsus_robo_inscricoes_` (a função recusa outro). Para parar antes:
`select cron.unschedule('agsus_robo_inscricoes_120_2026');`. Mudou o horário? Atualize esta tabela
e o "esperado" em `src/lib/saude-das-cargas.ts`.

**Mudar um horário** (SQL Editor do Supabase):

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = 'agsus_robo_sincronizar_selecao'),
  schedule => '10 11,16,21 * * *');
```

Depois, atualize esta tabela, a lista comentada na migration (para o próximo ambiente) e o
"esperado" em `src/lib/saude-das-cargas.ts`.

## A chave (token do GitHub)

O banco precisa de um token **fine-grained** que só dispare workflows deste repositório.

1. GitHub → foto → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.
2. **Resource owner:** `AgSUS-COGIP`. **Expiration:** a validade que a organização permitir
   (anote a data).
3. **Repository access:** **Only select repositories** → `agsus-monitora`.
4. **Repository permissions** → **Actions: Read and write** (o resto fica sem acesso).
5. Gere e copie o token (ele aparece uma vez só). Se a organização exigir aprovação, espere a
   aprovação antes do passo seguinte.

Cadastrar no Supabase: projeto → **Integrations** → **Vault** → **Secrets** → **Add new secret**,
nome **`github_disparo_robos`** e o token como valor. Não cole o token em outro lugar (chat,
arquivo, issue). O banco lê o segredo só na hora do pedido; o registro dos pedidos
(`TL_DISPARO_ROBO`) guarda workflow, hora, situação e código HTTP — nunca a chave.

### Quando expirar (ou for revogado)

O Status das atualizações mostra **Agenda dos robôs: Falhou** com "HTTP 401" (chave inválida ou
expirada) ou "403/404" (sem permissão no repositório). Gere um token novo com os mesmos passos e,
no Vault, **edite o segredo `github_disparo_robos`** trocando o valor (mesmo nome). O próximo
horário já usa a chave nova; para não esperar, use o **Rodar agora** de cada carga.

Sem o segredo, cada horário registra **SEM_TOKEN** (nada é pedido ao GitHub) e a linha avisa
"Sem chave no Vault". No **Rodar agora**, a linha diz: "A chave de disparo dos robôs expirou ou foi
recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos".

## Como saber se está funcionando

Configurações › Status das atualizações › **Agenda dos robôs**: último pedido aceito (o GitHub
responde 204), falhas e pedidos sem chave nas últimas 24 h; em "Detalhes", os 20 últimos pedidos.
As cargas (Entrevistas, Seleção, Conferências) continuam com o selo de atraso de sempre.

## A origem de cada disparo (20261020170000)

`TL_DISPARO_ROBO.TP_ORIGEM` diz de onde veio cada execução:

| Origem     | Quando                                                                                                               | `disparado_por` no workflow |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `AGENDA`   | tarefa do pg_cron (`p_origem => 'AGENDA'` no comando, ou a sessão `pg_cron`)                                         | `AGENDA`                    |
| `MONITORA` | Rodar agora, Opções ou Recalcular de quem está logado (`disparar_robo`), com o usuário                               | id do usuário               |
| `MANUAL`   | `private."FC_DISPARAR_ROBO"` chamado direto pelo SQL Editor/API, sem usuário                                         | `manual`                    |
| `GITHUB`   | Run workflow / `gh workflow run`: o 1º passo do workflow registra (`registrar_disparo_externo`), com o ator e o link | vazio                       |

O registro `GITHUB` é feito por `python/monitora/disparo_externo.py` com `continue-on-error`: se
falhar (banco fora, migration não aplicada), o workflow só mostra um aviso e segue.

**Os "AGENDA" de 13 a 15/10/2026 sem tarefa no cron.** Antes desta migration, todo pedido sem
usuário virava `AGENDA`. Na auditoria de 20/10, os pedidos do robô da Empregare às 7h e às 13h de
13, 14 e 15/10 batem com a tarefa `agsus_robo_inscricoes_114_2026` (removida em 22/10). Os outros —
robô em 14/10 17h06, 15/10 00h00, 01h40, 08h06 e 12h14, e pré-classificação em 13/10 20h10,
14/10 17h02, 15/10 01h10, 08h03 e 12h12 — não têm tarefa: são `FC_DISPARAR_ROBO` chamados à mão
pelo SQL (papel postgres), quase todos em par "pré-classificação + robô do 114/2026 com
`anexos = true`" (o filtro gravado em `TL_SYNC_EMPREGARE`), durante a recaptura dos anexos.
O das 00h00 de 15/10 tem horário redondo (pode ter sido uma tarefa avulsa criada e apagada); o
histórico do pg_cron daquele dia ficou no banco antigo e não pôde ser conferido. Daqui em diante,
esses pedidos aparecem como `MANUAL`.

## Desligar

```sql
select cron.unschedule('agsus_robo_sincronizar_selecao');  -- uma tarefa
-- todas:
select cron.unschedule(jobid) from cron.job where jobname like 'agsus\_robo\_%';
```

Desligou de vez? Devolva o `schedule` aos workflows (senão eles só rodam pelo Rodar agora) ou
aplique o rollback da migration.
