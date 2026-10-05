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

As próximas fases trazem a Provisória por ART e o lote (F2), a fila (F3) e a ficha (F4).

## Arquivos

```
avaliacao-documental.jsx  tela e montarAvaliacaoDocumental() (na #page-avaliacao-documental)
estado.js                 store sem React: editais, regra, equipe e as gravações (RPCs)
regra.jsx                 aba Regra: formulário, perguntas da carga, versões, aldeias
blocos.jsx                os blocos da ficha na regra
previa.jsx                "Testar com um candidato fictício"
equipe.jsx                aba Equipe
campos.jsx                peças de formulário da regra
avaliacao-documental.css  só tokens
```

## Regras

- A regra é **dado** do edital. Nenhum peso no código: o formato, os valores padrão e a validação
  ficam em `src/lib/avaliacao-documental/regra.js`, e o banco repete a validação em
  `private."FC_VALIDAR_REGRA_ANALISE"` (`supabase/migrations/20261006100000_regra_da_analise.sql`).
- A conta da prévia é `src/lib/avaliacao-documental/pontuacao.js`. É só para a tela: a conta
  oficial, em lote (Provisória, lote, nota declarada de todos os inscritos), é da base Python
  (`python/monitora/`), que grava o resultado pronto e reproduz os casos dourados de
  `tests/fixtures/avaliacao-documental/casos-de-pontuacao.json`. Nada de conta pesada em SQL.
- Quem coordena cada edital, o banco decide (`FC_PAPEL_AVALIACAO`); a tela só esconde os
  controles de quem não pode (`pode_coordenar`).
- Explicações vão para `docs/aya/regras-da-avaliacao-documental.md`, não para a tela.
- Testes: `tests/modulos/avaliacao-documental.test.js`, `tests/lib/avaliacao-documental-*.test.js`
  e `tests/avaliacao-documental-migration.test.js`.
