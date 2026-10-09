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

| Tarefa do pg_cron                    | Agenda (UTC)        | Brasília                    | Workflow                      |
| ------------------------------------ | ------------------- | --------------------------- | ----------------------------- |
| `agsus_robo_sincronizar_entrevistas` | `5 * * * *`         | de hora em hora, aos :05    | `sincronizar-entrevistas.yml` |
| `agsus_robo_sincronizar_selecao`     | `10 11,16,21 * * *` | 8h10, 13h10 e 18h10         | `sincronizar-selecao.yml`     |
| `agsus_robo_conferencias`            | `0 9 * * *`         | 6h                          | `conferencias.yml`            |
| `agsus_robo_expurgo_anexos_chat`     | `30 9 * * *`        | 6h30                        | `expurgo-anexos-chat.yml`     |
| `agsus_robo_conferir_disparos`       | `*/5 * * * *`       | a cada 5 min (lê respostas) | —                             |
| `agsus_robo_inscricoes_114_2026`     | `0 10,16 * * *`     | 7h e 13h, até 15/10/2026    | `robo-empregare.yml`          |

Robô da Empregare e pré-classificação estão na lista fixa da função; fora a agenda das inscrições
(abaixo), não têm agenda.

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

| Tarefa                           | Editais    | Agenda (UTC)    | Brasília | Até        | Desliga em |
| -------------------------------- | ---------- | --------------- | -------- | ---------- | ---------- |
| `agsus_robo_inscricoes_114_2026` | `114/2026` | `0 10,16 * * *` | 7h e 13h | 15/10/2026 | 16/10, 7h  |

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
`select cron.unschedule('agsus_robo_inscricoes_114_2026');`. Mudou o horário? Atualize esta tabela
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
As cargas (Entrevistas, Seleção, Conferências, Expurgo) continuam com o selo de atraso de sempre.

## Desligar

```sql
select cron.unschedule('agsus_robo_sincronizar_selecao');  -- uma tarefa
-- todas:
select cron.unschedule(jobid) from cron.job where jobname like 'agsus\_robo\_%';
```

Desligou de vez? Devolva o `schedule` aos workflows (senão eles só rodam pelo Rodar agora) ou
aplique o rollback da migration.
