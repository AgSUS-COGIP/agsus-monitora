---
tipo: referencia
area: modulo
atualizado: 2026-11-10
---

# Classificação: arquivos, contratos e testes

Mapa de `src/modulos/classificacao/` ([[modulo-classificacao]]).

```
classificacao.tsx  <TelaDeClassificacao>, montarClassificacao() e calcularClassificacao()
estado.ts          store sem React: editais da área, dados do edital, salvar regra, gerar, publicar,
                   desempate (sorteio/decisão), documento oficial (Copiar para o SEI, DOCX
                   timbrado, PDF) e XLSX; salvar os textos do documento
listas.tsx         visão "Lista": faixa de situação (cada número é o total da lista que abre),
                   avisos e pendências, gerar/exportar, BarraDaLista (nome ou código, vaga; em
                   Filtros, lista e situação; recorte na URL e na sessão por edital, regras em
                   src/lib/classificacao/dados.ts), TabelaDaLista agrupada por vaga (50 e mais 50,
                   posição como etiqueta), "Ver posição" e "⋯", eliminados, gaveta com a
                   explicação, registro do empate
publicar-aprovados.tsx  "Publicar como lista de aprovados"
agenda.tsx / estado-da-agenda.ts  visão "Agenda" e o store dela
regra.tsx          editor da regra (Regras do edital, etapa 4): critérios ordenáveis do catálogo,
                   empate final, modalidades, convocação, rodapé, versões; rascunho guardado a cada
                   mudança (src/app/rascunho-da-regra.ts, tipo CLASSIFICACAO) e que volta ao abrir
documento.tsx / colunas-do-documento.tsx / documento-no-navegador.ts  o documento oficial
hora-de-nascimento.tsx  hora da certidão na gaveta, só quando o empate chega à maior idade no
                   mesmo dia (sem certidão = 23:59:59)
classificacao.css  só o que é desta tela (tokens)
```

Regras puras em `src/lib/classificacao/`: `motor.ts`, `regra.ts`, `catalogo.ts`, `vagas.ts`,
`numeros.ts`, `sorteio.ts`, `exportacao.ts`, `ajustes.ts` (o motor com os ajustes da pontuação
aprovados em recurso e a prévia do recurso), `documento-sei.ts`, `documento-docx.ts`, `dados.ts`.

## Banco

`20261002150000_classificacao.sql` (+ `20261002150500_liga_aba_classificacao.sql`),
`20261002170000_classificacao_lista_da_entrevista.sql` (lista ENTREVISTA e critérios novos do
catálogo), `20261009130000_hora_de_nascimento_na_classificacao.sql` (`TB_HORA_NASCIMENTO_CANDIDATO`,
`salvar_hora_nascimento_candidato`; ensaio e rollback com o mesmo nome). Auditoria do 93/2026
(desempate do 10.1 na preliminar, quadro do 4.1):
`tests/fixtures/sql-de-dados/20261009-classificacao-93-desempate-e-quadro.sql` e
`tests/classificacao-93-desempate.test.js`. Regras dos editais:
`tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-83-e-100.sql` e
`…-todos-os-editais.sql` (131 editais lidos dos PDFs oficiais, 13 modelos; aplicar depois da
migration 20261002170000, rodando antes o ensaio
`supabase/ensaios/20261002-regras-de-classificacao-todos-os-editais.sql`).

## TypeScript

- Listas e filtros: saída pública do motor em `src/lib/classificacao/tipos-do-resultado.ts`
  (contratos de uso em `tests/tipos/listas-da-classificacao.tsx`); contratos internos em
  `tipos-do-motor.ts`. O estado valida a quantidade de pendências e a situação de publicação; ordem
  incompleta ou duplicada não é apresentada como sorteio registrado.
- Regra: `regra.ts` normaliza e valida a configuração, inclusive textos e colunas dos documentos;
  `edicao-da-regra.ts` converte as entradas e altera campos, grupos e listas sem modificar a regra
  vigente. O rascunho admite texto nos campos numéricos durante a edição; a normalização produz
  números. Cada edital recebe listas independentes na modalidade padrão. O histórico valida versão e
  configuração, preservando autoria, motivo e renomeações; só versões com configuração voltam ao
  formulário.
- Entrada e estado: contratos em `tipos-do-estado.ts`; `src/lib/classificacao/dados-do-estado.ts`
  valida os campos do seletor e os metadados, preservando os campos adicionais. Permissão de edição
  exige booleano; coleções malformadas são recusadas para não calcular lista com candidatos
  descartados.
- Troca de edital, área ou usuário invalida os efeitos locais de gravações e leituras: voltar ao
  mesmo ID não aceita resposta anterior (não altera dados, avisos nem botões); uma carga de logo
  antiga não inicia download; chamadas já enviadas não são canceladas. RPCs, versão conferida pelo
  banco e cálculos não mudaram.
- Documentos: retrato, XLSX, colunas e SEI/DOCX com contratos em `tipos-dos-documentos.ts` e entrada
  conferida por `dados-dos-documentos.ts`; nenhuma linha malformada é descartada para exportar o
  restante. Preservados: nome público, timbrado, numeração, notas de desempate e de decisão,
  horários da agenda e formatos XML. O cache do logo considera URL e largura; conversão que falha
  pode ser tentada de novo.

## Testes

`tests/lib/classificacao-*.test.js`, `tests/modulos/classificacao.test.js`,
`tests/classificacao-regras-dos-editais.test.js` (seed e um edital por modelo),
`tests/lib/classificacao-metadados-das-listas.test.js`,
`tests/lib/classificacao-edicao-da-regra.test.js`, `tests/tipos/regra-da-classificacao.tsx`,
`tests/tipos/tela-estado-da-classificacao.tsx`, `tests/lib/classificacao-dados-do-estado.test.js`,
`tests/modulos/classificacao-contexto-de-gravacao.test.js`; publicação e agenda em
[[classificacao-publicacao-e-agenda]].

## Relacionadas

- [[modulo-classificacao]] — a tela
- [[banco-e-migrations]] — ensaio, rollback e registro
- [[typescript-no-front]] — o estado da migração
