# `supabase/` — banco

- `migrations/` — **fonte de verdade do schema.** Nome `AAAAMMDDHHMMSS_descricao_em_portugues.sql`
  (14 dígitos, timestamp crescente e único). **Nunca editar migration já aplicada**: crie outra que
  corrige. Aplicação **manual** + registro em `public.migracoes_aplicadas`; **nunca `supabase db push`**.
  Processo completo em `migrations/README.md`.
- `rollback/` e `ensaios/` — desfazer e ensaiar (`begin; … rollback;`) cada migration, mesmo nome.
  Regras do rollback em "Rollback" abaixo.
- `migrations-historicas/` — já aplicadas, só histórico; **não reaplicar** (`perfis_usuarios`,
  `search_path` não vazio, nomes pré-MAD). O registro as guarda como `migrations/<arquivo>`.
- `descartadas/` — decididas para **nunca aplicar** (acesso automático @agenciasus, bridge da IA
  local da Aya). Não trazer de volta; o teste `tests/migrations-pasta-limpa.test.js` impede.
- `correcoes/` — SQL de **correção de dados** (coordenadas de unidades, polos, aldeias), nome
  `AAAAMMDD-descricao.sql`. Não é schema: roda uma vez, junto com a auditoria que o justificou
  (`docs/auditoria-oficial-das-coordenadas-2026-10-01.md`).
- `.temp/` — estado local da CLI do Supabase; ignore.

Não ler inteiro: `migrations-historicas/20260918160000_padronizacao_nomenclatura_tabelas.sql` (148 KB).

Regras:

- O app só fala por **RPC** (`SECURITY DEFINER`). Criou/alterou RPC → atualize `src/lib/rpc-contrato.js`.
- RLS ligada por padrão; não desligar para "resolver" permissão.
- Nomenclatura MAD: prefixo tipológico, MAIÚSCULAS, aspas duplas (PDTIC 2026–2027, resumido em
  `docs/padronizacao_nomenclatura_*.md`; o PDF fica fora do repositório). A skill `mad-ddl-review` revisa o DDL antes de aplicar.
- Banco só valida a gravação de uma linha e guarda; cálculo em lote é do Python (scripts/ + RPC
  service_role enxuta). O cálculo dos itens da ficha tem paridade tela × banco × Python pelos casos de
  `tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json`.
- Validar: `npm run check:rpc-contract:db`, `npm run db:capturar-baseline`,
  `node scripts/estado-das-migrations.mjs` e o `scripts/validar-migration-*.mjs` do tema, quando houver.

## Rollback

Toda migration tem `rollback/<mesmo nome>.sql`. O que ele precisa ter:

- **Transação e guardas.** Fica em `begin; … commit;`. Antes de mexer em qualquer coisa, aborta com
  `raise exception` se a migration não estiver aplicada (o objeto que ela cria não existe) ou se
  houver dado que o estado antigo não aceita (ex.: linha que a CHECK antiga recusaria). Um rollback
  que falha no meio não pode deixar o banco pela metade.
- **Volta ao corpo de antes, letra por letra.** Função trocada volta com o `prosrc` e o `COMMENT` da
  migration anterior, copiados, e não reescritos de memória. O mesmo vale para constraint e
  comentário de coluna. Depois remove o que a migration criou: tarefas do pg_cron
  (`cron.unschedule`), funções e tabelas. Remove na ordem inversa das dependências.
- **Dado não se desfaz.** Linhas gravadas, histórico (`TH_*`) e estados já corrigidos (ex.: tarefa
  que o alinhador desligou) ficam como estão. O comentário de topo diz o que fica e por quê.
- **Teste.** O rollback restaura exatamente o banco de antes: as mesmas funções, constraints,
  comentários e tabelas. Quando a migration troca função, o modelo é
  `tests/catalogo-dos-robos-no-banco.test.ts` (PGlite: hoje × migrada × migrada + rollback com as
  mesmas respostas). No mínimo, um teste estático confere que os blocos restaurados são idênticos aos
  da migration anterior.

Ao aplicar um rollback em produção:

1. Rodar o arquivo inteiro no SQL Editor. Na pergunta sobre RLS, escolha rodar sem acrescentar
   nada: a opção "enable RLS" põe um `alter table` no fim do script, depois do `commit`/`rollback`.
   No ensaio, isso dá erro numa tabela temporária que já sumiu.
2. Tirar o registro da migration, para `db:estado` voltar a mostrá-la como pendente:
   `delete from public.migracoes_aplicadas where caminho = 'migrations/<arquivo>.sql';`
3. Se o front já dependia da migration (RPC nova), voltar o front antes, ou junto.

**Sem `psql` nem `SUPABASE_DB_URL`** (a máquina de desenvolvimento não tem), o registro e a remoção do
registro são feitos à mão no SQL Editor. O hash é o de `hashDoConteudo` em
`scripts/estado-das-migrations-nucleo.mjs` (sha256 sem `\r`).
