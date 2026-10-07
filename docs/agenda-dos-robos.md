# Agenda dos robôs (o banco pede ao GitHub)

O `schedule` do GitHub Actions, no plano gratuito, atrasa e pula execuções (em 06–07/10/2026 as
sincronizações de hora em hora rodaram a cada 5–8 h). Por isso **o banco é o único agendador**:
o pg_cron chama `private."FC_DISPARAR_ROBO"`, que pede a execução ao GitHub pela API
(`workflow_dispatch`, ramo `main`, `disparado_por = AGENDA`) com o pg_net. Os workflows não têm
mais `schedule`; continuam com o **Rodar agora** e o **Run workflow**.

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

Robô da Empregare e pré-classificação estão na lista fixa da função, mas não têm agenda.

**Mudar um horário** (SQL Editor do Supabase):

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = 'agsus_robo_sincronizar_selecao'),
  schedule => '10 11,16,21 * * *');
```

Depois, atualize esta tabela, a lista comentada na migration (para o próximo ambiente) e o
"esperado" em `src/lib/saude-das-cargas.js`.

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
"Sem chave no Vault".

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
