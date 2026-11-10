---
tipo: regra
area: banco
atualizado: 2026-11-10
---

# Rollback de migration

Toda migration tem `supabase/rollback/<mesmo nome>.sql` (e o ensaio em `supabase/ensaios/`).
`tests/migrations-pasta-limpa.test.js` cobra os dois.

## O que o rollback precisa ter

- **Transação e guardas.** Fica em `begin; … commit;`. Antes de mexer em qualquer coisa, aborta com
  `raise exception` se a migration não estiver aplicada (o objeto que ela cria não existe) ou se
  houver dado que o estado antigo não aceita (ex.: linha que a CHECK antiga recusaria). Um rollback
  que falha no meio não pode deixar o banco pela metade.
- **Volta ao corpo de antes, letra por letra.** Função trocada volta com o corpo e o `COMMENT`
  vigentes antes dela, copiados do banco (`pg_get_functiondef`, `obj_description`), não reescritos
  de memória nem tirados de migration antiga. O mesmo vale para constraint e comentário de coluna.
  Depois remove o que a migration criou: tarefas do pg_cron (`cron.unschedule`), funções e tabelas,
  na ordem inversa das dependências.
- **Dado não se desfaz.** Linhas gravadas, histórico (`TH_*`) e estados já corrigidos (ex.: tarefa
  que o alinhador desligou) ficam como estão. O comentário de topo diz o que fica e por quê.
- **Teste.** O rollback restaura exatamente o banco de antes: as mesmas funções, constraints,
  comentários e tabelas. Quando a migration troca função, o modelo é
  `tests/catalogo-dos-robos-no-banco.test.ts` (PGlite: hoje × migrada × migrada + rollback com as
  mesmas respostas; o "hoje" fica numa fixture com os corpos copiados do banco). No mínimo, um
  teste estático confere que os blocos restaurados são idênticos aos de antes.

## Aplicar um rollback em produção

1. Rodar o arquivo inteiro no SQL Editor. Na pergunta sobre RLS, escolha rodar sem acrescentar
   nada: a opção "enable RLS" põe um `alter table` no fim do script, depois do
   `commit`/`rollback` (no ensaio, isso dá erro numa tabela temporária que já sumiu).
2. Tirar o registro da migration, para `db:estado` voltar a mostrá-la como pendente:
   `delete from public.migracoes_aplicadas where caminho = 'migrations/<arquivo>.sql';`
3. Se o front já dependia da migration (RPC nova), voltar o front antes, ou junto.

Sem `psql` nem `SUPABASE_DB_URL` (a máquina de desenvolvimento não tem), o registro e a remoção do
registro são feitos à mão no SQL Editor (hash de `hashDoConteudo` em
`scripts/estado-das-migrations-nucleo.mjs`, sha256 sem `\r`).

## Relacionadas

- [[banco-e-migrations]] — o processo da migration
- [[testes]] — o banco de verdade em PGlite
