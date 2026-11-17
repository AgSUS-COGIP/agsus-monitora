---
tipo: referencia
area: modulo
atualizado: 2026-11-17
---

# Classificação por dentro: banco, contratos, motor em Python e testes

O que fica atrás da tela da [[modulo-classificacao]]: onde está cada peça, as migrations, os
contratos TypeScript, a cópia do motor em Python e os testes. Guia geral e histórico das etapas do
Python em [python-no-monitora.md](../python-no-monitora.md) e [[python-e-jobs]].

## Código

Tela em `src/modulos/classificacao/`:

- `classificacao.tsx` (`<TelaDeClassificacao>`, `montarClassificacao()`, `calcularClassificacao()`).
- `estado.ts`: store sem React — editais da área, dados do edital, salvar regra, gerar, publicar,
  desempate (sorteio/decisão), documento oficial (Copiar para o SEI, DOCX timbrado, PDF), XLSX e os
  textos do documento.
- `listas.tsx` (visão "Lista", com `CalculoPeloPython`), `publicar-aprovados.tsx`, `agenda.tsx` /
  `estado-da-agenda.ts`, `documento.tsx` / `colunas-do-documento.tsx` / `documento-no-navegador.ts`,
  `hora-de-nascimento.tsx`, `classificacao.css` (só tokens).
- `regra.tsx`: editor da regra (Regras do edital, etapa 4) — critérios ordenáveis do catálogo,
  empate final, modalidades, convocação, rodapé, versões; rascunho guardado a cada mudança
  (`src/app/rascunho-da-regra.ts`, tipo CLASSIFICACAO) que volta ao abrir.

Regras puras em `src/lib/classificacao/`: `motor.ts`, `regra.ts`, `edicao-da-regra.ts`,
`catalogo.ts`, `vagas.ts`, `numeros.ts`, `sorteio.ts`, `exportacao.ts`, `ajustes.ts` (o motor com os
ajustes da pontuação aprovados em recurso e a prévia do recurso), `documento-sei.ts`,
`documento-docx.ts`, `dados.ts`, `relatorio-de-desempate.ts`, `calculo-em-python.ts`. Fora da pasta:
`src/lib/aprovados/publicacao-de-aprovados.ts` e `src/lib/entrevistas/agenda-das-entrevistas.ts`.

## Banco

- `20261002150000_classificacao.sql` (+ `20261002150500_liga_aba_classificacao.sql`),
  `20261002170000_classificacao_lista_da_entrevista.sql` (lista ENTREVISTA e critérios novos do
  catálogo), `20261009130000_hora_de_nascimento_na_classificacao.sql`
  (`TB_HORA_NASCIMENTO_CANDIDATO`, `salvar_hora_nascimento_candidato`).
- Publicação: `20261005160000_lista_de_aprovados_da_classificacao.sql`; agenda:
  `20261005120000_agenda_das_entrevistas.sql`. Essas três últimas têm ensaio e rollback com o mesmo
  nome.
- Regras dos editais: `tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-83-e-100.sql` e
  `…-todos-os-editais.sql` (131 editais lidos dos PDFs oficiais, 13 modelos; aplicar depois da
  migration `20261002170000`, rodando antes o ensaio
  `supabase/ensaios/20261002-regras-de-classificacao-todos-os-editais.sql`).
- Auditoria do 93/2026 (desempate do 10.1 na preliminar, quadro do 4.1):
  `tests/fixtures/sql-de-dados/20261009-classificacao-93-desempate-e-quadro.sql` e
  `tests/classificacao-93-desempate.test.js`.

## Contratos TypeScript

Tudo em TypeScript/TSX. O que vem do banco é conferido na fronteira, sem descartar linhas em
silêncio:

- **Listas e filtros**: saída pública do motor em `tipos-do-resultado.ts` (contratos de uso em
  `tests/tipos/listas-da-classificacao.tsx`); internos em `tipos-do-motor.ts`. O estado valida a
  quantidade de pendências e a situação de publicação; ordem incompleta ou duplicada não é
  apresentada como sorteio registrado.
- **Regra**: `regra.ts` normaliza e valida a configuração, inclusive textos e colunas dos
  documentos; `edicao-da-regra.ts` converte as entradas e altera campos, grupos e listas sem
  modificar a regra vigente. O rascunho admite texto nos campos numéricos durante a edição; a
  normalização produz números. Cada edital recebe listas independentes na modalidade padrão. O
  histórico valida versão e configuração, preservando autoria, motivo e renomeações; só versões com
  configuração voltam ao formulário.
- **Entrada e estado**: `tipos-do-estado.ts`; `dados-do-estado.ts` valida os campos do seletor e os
  metadados, preservando os adicionais. Permissão de edição exige booleano; coleções malformadas
  são recusadas para não calcular lista com candidatos descartados.
- **Documentos**: retrato, XLSX, colunas e SEI/DOCX em `tipos-dos-documentos.ts`, entrada conferida
  por `dados-dos-documentos.ts`; nenhuma linha malformada é descartada para exportar o restante.
  Preservados: nome público, timbrado, numeração, notas de desempate e de decisão, horários da
  agenda e formatos XML. O cache do logo considera URL e largura; conversão que falha pode ser
  tentada de novo.
- **Publicação**: `src/lib/aprovados/tipos-da-publicacao-de-aprovados.ts` e
  `dados-da-publicacao-de-aprovados.ts`. **Agenda**: `src/lib/entrevistas/tipos-da-agenda.ts` e
  `dados-da-agenda.ts`.
- **Troca de edital, área ou usuário** invalida os efeitos locais de gravações e leituras: voltar ao
  mesmo ID não aceita resposta anterior (inclusive A → B → A; não altera dados, avisos nem botões);
  uma carga de logo antiga não inicia download; chamadas já enviadas não são canceladas.

## Motor em Python

`python/monitora/classificacao/` é a cópia fiel do motor (`motor.ts`) e do retrato, conferida pelos
casos dourados `tests/fixtures/classificacao/casos-do-motor.json`, nos dois lados. Os scripts de
`scripts/classificacao/` comparam o Python com o motor da tela. Duas chaves da automação
([[robos-e-agenda]]) controlam o uso.

### Etapa 2a: relatório de desempate

- Gerar a lista pede o relatório de desempate ao job (`registrar_lista_classificacao` → workflow
  `classificacao.yml`, chave "Classificação em Python", `classificacao`); o job só grava o relatório
  quando o retrato que ele calcula é o da lista registrada.
- Na visão Listas, "Relatório de desempate sendo preparado…" até chegar (relê a cada 10 s, espera
  até 15 min); depois, "Relatório de desempate (XLSX)" e "(PDF)", com nome e inscrição.
- Versão 2 (`20261023230000_relatorio_de_desempate_versao_2.sql`): cabeçalho da lista, idade em anos
  na data de corte, resumo por critério, lista geral ou de cota no título do grupo; XLSX com Resumo,
  Grupos, Pares e Candidatos com filtro; PDF com índice por vaga e o cabeçalho da vaga repetido; a
  versão 1 continua abrindo.
- Se não conferir ou falhar, um aviso (`obter_desempate_da_lista`, `estadoDoRelatorio`).
- Banco: `20261023140000_classificacao_em_python_e_relatorio_de_desempate.sql` e
  `20261023170000_classificacao_em_python_etapa_2.sql`.

### Etapa 2b: "Gerar listas pelo Python"

Migration `20261023200000_classificacao_em_python_etapa_2b.sql`, atrás da chave "Gerar listas pelo
Python" (`classificacao_calculo`), que nasce **desligada**: ligar só depois da publicação do
114/2026; só vale com "Classificação em Python" também ligada (`20261024110000`).

- Desligada, o "Gerar" é o de sempre (`motor.ts` + `registrar_lista_classificacao`;
  `pedir_calculo_classificacao` só responde `{ligada: false}`).
- Ligada, `gerarLista` (`estado.ts`) pede o cálculo ao job, mostra "Calculando a lista… (até
  5 min)", relê o pedido a cada 3 s, recebe o retrato do Python e só registra
  (`registrar_lista_calculada`, que confere de novo no banco) quando ele é igual ao do `motor.ts`.
- Diferente: aviso e `registrar_divergencia_do_calculo` (só os caminhos). Falhou, não chegou ao
  GitHub ou passou do prazo: aviso com "Tentar de novo".

## Testes

- Tela e regras: `tests/lib/classificacao-*.test.js`, `tests/modulos/classificacao.test.js`,
  `tests/modulos/classificacao-contexto-de-gravacao.test.js`,
  `tests/classificacao-regras-dos-editais.test.js` (seed e um edital por modelo).
- Publicação: `tests/lib/publicacao-de-aprovados.test.ts`,
  `tests/lib/dados-da-publicacao-de-aprovados.test.ts` e o fluxo em
  `tests/modulos/classificacao.test.js`.
- Agenda: `tests/lib/dados-da-agenda.test.ts`, `tests/lib/agenda-das-entrevistas.test.ts`,
  `tests/modulos/agenda-das-entrevistas.test.js`, `tests/modulos/agenda-contexto-de-gravacao.test.js`.
- Contratos de compilação em `tests/tipos/`: `regra-da-classificacao.tsx`,
  `tela-estado-da-classificacao.tsx`, `listas-da-classificacao.tsx`,
  `publicacao-da-classificacao.tsx`, `agenda-da-classificacao.tsx`.

## Relacionadas

- [[modulo-classificacao]] — a tela
- [[python-e-jobs]] — padrões do código Python
- [[robos-e-agenda]] — as duas chaves da automação e como o banco dispara o workflow
- [[banco-e-migrations]] — ensaio, rollback e registro
- [[regras-do-codigo]] — TypeScript e validação na fronteira
- [[testes]] — como rodar
