# Configurações › Módulos e abas

O módulo inteiro está em React e TypeScript: `modulos.tsx` monta a tela,
`estado.ts` concentra carga, rascunho e salvamento, e `tipos.ts` declara
contratos de dados, alvos, campos e ações. As regras puras ficam em
`src/lib/modulos-e-abas.ts`; a leitura da resposta, em
`src/lib/arvore-dos-modulos.ts`. O CSS e os controles de `src/ui/` são preservados.

Apenas o administrador global carrega a árvore. As alterações do sistema,
áreas, abas, abas por área e painéis se acumulam no rascunho e são enviadas
em lote com motivo. Revisão, histórico, manutenção, beta, comemorações e
confirmação de saída continuam no mesmo fluxo. O snapshot e os mapas do
rascunho são expostos somente para leitura; cada alvo exige suas identificações.

O cliente Supabase permanece compartilhado, usando `obter_modulos_e_abas`
e `salvar_situacao_modulos`, sem alterar RPCs, permissões ou migrations.
As recusas do banco preservam as alterações pendentes. Respostas de carga
ou salvamento iniciadas numa sessão anterior não publicam dados, avisos ou
confirmações na sessão seguinte.

A resposta da árvore é validada antes de entrar no estado: objetos, listas,
identificações textuais não vazias, textos opcionais e booleanos. Listas ausentes
viram listas vazias; campos extras são ignorados. Uma releitura malformada mantém
a última árvore válida e o rascunho, exibindo o erro. A contagem inválida ou
ausente na confirmação de salvamento usa o tamanho do lote enviado.

Essa validação cobre os campos consumidos pela tela. Os valores anterior e novo
do histórico continuam como `unknown`, convertidos em texto na apresentação.
As situações recebidas continuam textuais para compatibilidade com o banco;
as ações da interface aceitam apenas os estados existentes. O compilador não
verifica os consumidores JavaScript nem substitui a autorização do banco.

Testes de regras, tela e respostas estão em `tests/modulos-e-abas.test.js`,
`tests/modulos/modulos.test.js` e `tests/arvore-dos-modulos.test.js`, com RPCs
simuladas e rede bloqueada. `tests/tipos/modulos.tsx` confere os contratos
positivos e as rejeições esperadas no compilador estrito.
