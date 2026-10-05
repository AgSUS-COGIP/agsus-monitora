# `src/modulos/avaliacao-documental/` — Avaliação documental

A tela de trabalho da etapa "Avaliação Documental e de Títulos" (view `avaliacao-documental`,
recurso `avaliacao_documental`). O Painel das análises (`src/modulos/analises/`, view `analises`)
continua sendo a leitura. Desenho e fases: `docs/analises-no-monitora/`; histórias AM-n em
`docs/historias-de-usuario/analises-no-monitora.md`.

## Fase F1 (esta)

- escolha do edital da área atual;
- **Regra**: criar a partir de um modelo, editar os blocos (eliminatórios com item do edital,
  critério étnico com aldeias, títulos por nível, cursos por faixa, vínculos), a eliminação
  automática e a nota declarada da Provisória, o lote e a reposição, a distribuição e a revisão,
  os modelos de parecer e as observações prontas; ligar as perguntas da última carga da Empregare
  aos blocos; salvar em versões com motivo; marcar como conferida; ver as versões;
- **Testar com um candidato fictício**: a conta pura sobre o rascunho, sem gravar;
- **Equipe**: analistas, revisores e coordenação (o gestor do edital já coordena).

## Fase F2

- **Pré-classificação**: a Lista Geral de Classificação Provisória por ART e o lote de convocação
  de cada vaga, como o job Python gravou (`scripts/pre_classificacao/`); contadores (inscritos,
  eliminados, ranqueados, lote "N de M", divergência ART × declarada), a linha de corte, os
  eliminados com o motivo e os avisos da vaga;
- "Recalcular" (coordenação): `POST /api/rodar-carga` com o edital, travado com a regra não
  conferida ou o job rodando;
- tamanho do lote por vaga: o campo vira `lote.por_vaga` numa versão nova da regra (com motivo);
- listas oficiais PROVISORIA e LOTE (cada reposição, se a regra publica): registradas no banco
  (`registrar_lista_pre_classificacao`) e exportadas pelo gerador da Classificação.

As próximas fases trazem a fila (F3) e a ficha (F4).

## Arquivos

```
avaliacao-documental.jsx  tela e montarAvaliacaoDocumental() (na #page-avaliacao-documental)
estado.js                 store sem React: editais, regra, equipe e as gravações (RPCs)
regra.jsx                 aba Regra: formulário, perguntas da carga, versões, aldeias
blocos.jsx                os blocos da ficha na regra
previa.jsx                "Testar com um candidato fictício"
equipe.jsx                aba Equipe
pre-classificacao.jsx     aba Pré-classificação (contadores, vagas, listas oficiais)
estado-da-pre-classificacao.js  store da aba: obter_pre_classificacao, Recalcular,
                          registrar/publicar as listas, Copiar para o SEI e DOCX
campos.jsx                peças de formulário da regra
avaliacao-documental.css  só tokens
```

## Regras

- A regra é **dado** do edital. Nenhum peso no código: o formato, os valores padrão e a validação
  ficam em `src/lib/avaliacao-documental/regra.js`, e o banco repete a validação em
  `private."FC_VALIDAR_REGRA_ANALISE"` (`supabase/migrations/20261006100000_regra_da_analise.sql`).
- A conta da pré-classificação é do job Python (`python/monitora/avaliacao_documental/`); a
  cópia em `src/lib/avaliacao-documental/pre-classificacao.js` só faz a prévia (tamanho sugerido do
  lote) e é conferida com o Python pelos casos de
  `tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json`. A aba não recalcula
  ninguém: lê o que o job gravou (`src/lib/avaliacao-documental/tela-da-pre-classificacao.js`).
- A conta da prévia é `src/lib/avaliacao-documental/pontuacao.js`. É só para a tela: a conta
  oficial, em lote (Provisória, lote, nota declarada de todos os inscritos), é da base Python
  (`python/monitora/`), que grava o resultado pronto e reproduz os casos dourados de
  `tests/fixtures/avaliacao-documental/casos-de-pontuacao.json`. Nada de conta pesada em SQL.
- Quem coordena cada edital, o banco decide (`FC_PAPEL_AVALIACAO`); a tela só esconde os
  controles de quem não pode (`pode_coordenar`).
- Explicações vão para `docs/aya/regras-da-avaliacao-documental.md`, não para a tela.
- Testes: `tests/modulos/avaliacao-documental.test.js`,
  `tests/modulos/avaliacao-documental-pre-classificacao.test.js`,
  `tests/lib/avaliacao-documental-*.test.js`, `tests/avaliacao-documental-migration.test.js`,
  `tests/pre-classificacao-migration.test.js`, `tests/python/test_pre_classificacao.py` e
  `tests/python/test_pre_classificacao_job.py`.
