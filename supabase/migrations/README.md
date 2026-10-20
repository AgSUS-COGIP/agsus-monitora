# `supabase/migrations/` — como o MONITORA muda o banco

## O processo, em uma frase

Migrations são **aplicadas à mão** (SQL Editor do Supabase ou `psql`), por quem opera o banco,
depois de ensaiadas, e **registradas** em `public.migracoes_aplicadas` pelo caminho e pelo sha256
do arquivo. **Não se usa `supabase db push`** (nem `supabase migration up`/`db reset` contra o
banco do projeto).

Por que não `db push`:

- o registro do projeto é `public.migracoes_aplicadas` (caminho + sha256 sem `\r`), não
  `supabase_migrations.schema_migrations`; a CLI não conhece o que já foi aplicado e tentaria
  rodar tudo de novo;
- há versões (timestamps) repetidas, já aplicadas e registradas pelo caminho (lista abaixo), que
  a CLI recusa;
- várias mudanças dependem de dados e de ordem que só o ensaio confere (correções em
  `supabase/correcoes/`, cargas dos robôs), e a escrita no banco é decisão da equipe, não da
  ferramenta.

## Passo a passo de uma migration nova

1. **Arquivo** `supabase/migrations/AAAAMMDDHHMMSS_descricao_em_portugues.sql`: timestamp de
   **14 dígitos**, único (confira antes de abrir a PR — duas PRs em paralelo já escolheram o mesmo
   horário), descrição no infinitivo dizendo o efeito. `begin;`/`commit;`, idempotente, cabeçalho
   com motivo, dependentes e rollback. Nomenclatura MAD e `search_path = ''` em
   `SECURITY DEFINER` (`docs/banco-de-dados.md`).
2. **Rollback** em `supabase/rollback/<mesmo nome>.sql`.
3. **Ensaio** em `supabase/ensaios/<mesmo nome>.sql`: o SQL dentro de `begin; … rollback;`, com as
   conferências que reprovam o resultado. Roda no banco antes de aplicar de verdade.
4. Criou/alterou RPC → `src/lib/rpc-contrato.js` e `npm run check:rpc-contract`.
5. **Aplicar** o arquivo no banco (SQL Editor ou `psql`), depois do merge/aprovação.
6. **Registrar**:

   ```
   npm run db:estado -- --registrar=migrations/<arquivo>.sql   # marca, não executa
   npm run db:estado                                           # o que falta / divergiu
   ```

   (`SUPABASE_DB_URL` no ambiente, ex.: `node --env-file=.env.local scripts/estado-das-migrations.mjs`.)
   Marcar sem ter aplicado é a única forma de o registro mentir.

**Nunca editar uma migration já aplicada**: o hash deixa de bater (estado "divergente"). Mudou o
efeito → migration nova.

## Onde fica cada coisa

| Pasta                             | O que é                                                                                       | Aplica?                      |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------- |
| `supabase/migrations/`            | schema, em ordem de timestamp                                                                 | sim, uma a uma, e registra   |
| `supabase/rollback/`              | como desfazer cada migration (mesmo nome)                                                     | só para desfazer             |
| `supabase/ensaios/`               | ensaio de cada migration/correção, sempre termina em `rollback`                               | antes de aplicar (não grava) |
| `supabase/tests/`                 | testes SQL de RPCs específicas                                                                | não grava                    |
| `supabase/correcoes/`             | correções de dados (`AAAAMMDD-descricao.sql`), uma vez, à mão; registradas como `correcoes/…` | uma vez, e registra          |
| `supabase/migrations-historicas/` | já aplicadas, mantidas só para histórico; perigosas se reaplicadas (ver o README de lá)       | **nunca**                    |
| `supabase/descartadas/`           | decididas para nunca aplicar (acesso automático @agenciasus, bridge da IA local da Aya…)      | **nunca**                    |

`tests/migrations-pasta-limpa.test.js` garante que esta pasta só tem `.sql` com timestamp de 14
dígitos e que nada de `descartadas/` volta para cá.

## Timestamps repetidos (já aplicados; não renomear)

O registro guarda o **caminho**: renomear um destes arquivos faria a migration aparecer como
órfã e como pendente. Ficam como estão, e `tests/estado-das-migrations.test.js` impede um par
novo.

| Timestamp        | Arquivos                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| `20260928180000` | `analises_do_painel_por_area`, `autoria_e_trava_da_lista_de_aprovados` |
| `20260928190000` | `anexos_do_candidato_aprovado`, `remove_rpcs_do_painel_react`          |
| `20260928200000` | `analises_painel_mais_leve`, `anexos_do_candidato_em_bytea`            |
| `20261001150000` | `ausentes_com_permissao_do_sync`, `sub_judice_alteracao`               |
| `20261002090000` | `convocacao_serie_mgi`, `kpis_depois_da_carga_da_selecao`              |
| `20261013120000` | `esvaziar_logs`, `rascunho_das_regras`                                 |
| `20261013140000` | `menos_chamadas_e_log`, `quadro_da_vaga_pelo_titulo`                   |

## Pendentes antigas que a equipe ainda confirma

A auditoria do registro (13/10/2026, `supabase/correcoes/20261013-registro-das-migrations.sql`)
deixou sem registro, por não haver objeto para conferir, seis migrations de setembro que mexem
só em dados, grants ou configuração. Continuam aqui (nenhuma depende de objeto removido) e
aparecem como pendentes em `npm run db:estado` até alguém confirmar no banco e registrar:

`20260909114500_platform_assets_6mb`,
`20260921130000_corrige_acentos_das_funcoes_restantes`, `20260922120000_editais_existentes_como_usi`,
`20260923153000_corrigir_concluido_saude_indigena`,
`20260924112623_permitir_contexto_permissoes_autenticado`,
`20260929180000_cce_e_escritorio_em_projetos`.
