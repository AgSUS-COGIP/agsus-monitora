---
tipo: regra
area: operacao
atualizado: 2026-11-10
---

# Documentação: como a biblioteca funciona

A documentação do MONITORA é um vault do Obsidian com a raiz do repositório como vault. O
`CLAUDE.md` da raiz é o índice (a nota central); cada assunto é uma nota curta em
`docs/biblioteca/`, ligada às outras por `[[wikilinks]]`.

## Onde fica cada coisa

| Pasta ou arquivo             | O que é                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `CLAUDE.md` (raiz)           | índice: o projeto em poucas linhas, as regras que não podem faltar e os links das notas   |
| `docs/biblioteca/`           | notas atômicas, uma por assunto, em kebab-case (`banco-e-migrations.md`)                  |
| `docs/_templates/`           | modelos: `nota.md`, `modulo.md`, `decisao.md`                                             |
| `docs/_arquivo/`             | o que saiu de uso: auditorias datadas, passagens de trabalho, propostas superadas         |
| `docs/biblioteca.base`       | a visão "Biblioteca" do Obsidian: tabela das notas com tipo, área e data                  |
| `docs/*.md` (fora das pastas) | documentos longos de referência, citados por código ou pela Aya; as notas apontam para eles |
| `docs/aya/`                  | base de conhecimento da Aya, compilada para o app (ver [[aya-base-de-conhecimento]])      |
| `CLAUDE.md` das pastas       | só a regra local da pasta (10 a 30 linhas) e os links das notas                            |
| `DESIGN.md` (raiz)           | guia normativo de interface (ver [[design-e-tokens]])                                     |

## Regras

- **Uma nota por assunto**, de 30 a 120 linhas, com cabeçalho YAML: `tipo` (regra, guia, modulo,
  decisao, referencia), `area` (front, banco, seguranca, testes, operacao, modulo) e
  `atualizado` (AAAA-MM-DD). Comece pelo modelo de `docs/_templates/`.
- **Nome único no vault.** Uma nota não pode ter o nome de outro `.md` visível (por exemplo
  `docs/python-no-monitora.md` ou `docs/aya/assistente-aya.md`): o `[[link]]` ficaria ambíguo.
- **Toda nota é ligada por outra** (ou pelo índice) e todo `[[link]]` aponta para uma nota que
  existe. `npm run check:docs` (`scripts/checar-links-da-biblioteca.mjs`, também no
  `check:architecture`) confere as duas coisas e os nomes repetidos.
- Arquivo fora da biblioteca se cita com link markdown relativo (`[guia](../banco-de-dados.md)`) ou caminho
  em crase, não com `[[ ]]`.
- **Documento descreve o código**; quando divergirem, corrija o documento. Nada de duplicar: o
  assunto mora numa nota e as outras ligam para ela.
- Documento novo: nome em português, kebab-case; registro pontual leva a data no nome
  (`auditoria-…-AAAA-MM-DD.md`) e vai para `docs/_arquivo/` quando deixar de valer.
- Módulo novo ganha nota `modulo-<nome>` (modelo `docs/_templates/modulo.md`), não README na pasta.
  Não há README fora da raiz do repositório (o da raiz é a capa do GitHub): código, testes e a Aya
  citam a nota.
- `docs/aya/` não se reorganiza: é compilada por `npm run aya:conhecimento` e os testes leem os
  arquivos.

## Abrir no Obsidian

1. Obsidian → "Open folder as vault" → a pasta do repositório.
2. `.obsidian/app.json` (versionado) tira do gráfico e da busca `src/`, `tests/`,
   `node_modules/`, `public/` e as outras pastas de código; o trecho de CSS
   `.obsidian/snippets/so-documentacao.css` (ligado em `appearance.json`) as tira da lista de
   arquivos. O resto de `.obsidian/` é estado de cada pessoa e fica fora do Git.
3. Comece pelo `CLAUDE.md` e pela visão `docs/biblioteca.base`; o gráfico (Ctrl+G) mostra o
   índice no centro.

### As cores do gráfico

`.obsidian/graph.json` (versionado) traz os grupos, os modelos escondidos (`-path:docs/_templates`)
e os nomes visíveis de mais longe. Ao mexer no gráfico (zoom, forças), o Obsidian regrava o
arquivo: não commite essa mudança, só a de grupos e filtros. Para editar o `graph.json` fora do
Obsidian, feche-o antes: aberto, ele grava a configuração da memória por cima.

| Cor     | O que é                                              |
| ------- | ---------------------------------------------------- |
| roxo    | `CLAUDE.md` (o índice da raiz e os das pastas)       |
| azul    | notas de tela (`modulo-*`)                           |
| verde   | as outras notas da biblioteca                        |
| laranja | a base da Aya (`docs/aya/`)                          |
| ciano   | documentos longos (`docs/`, `DESIGN`, `README`, `LEIA-ME`) |
| cinza   | o que saiu de uso (`docs/_arquivo/`)                 |

Nenhum documento fica solto: cada `regras-*.md` da Aya é ligado pela nota da tela (e todos por
[[aya-base-de-conhecimento]]), e o arquivo pela lista abaixo.

## O que saiu de uso (`docs/_arquivo/`)

Guardado como histórico; não descreve o sistema de hoje.

- [arquitetura](../_arquivo/arquitetura.md) e [arquitetura-evolucao](../_arquivo/arquitetura-evolucao.md) — propostas de arquitetura anteriores ao app React único
- [auditoria-sedes-dsei-2026-09-16](../_arquivo/auditoria-sedes-dsei-2026-09-16.md) — a auditoria das sedes dos DSEIs (a atual está em [[coordenadas]])
- [handoff-codex-mapas](../_arquivo/handoff-codex-mapas.md) — passagem de trabalho dos mapas
- [padronizacao_nomenclatura_mapa](../_arquivo/padronizacao_nomenclatura_mapa.md) e [padronizacao_nomenclatura_ajustes_frontend](../_arquivo/padronizacao_nomenclatura_ajustes_frontend.md) — a troca de nomes para o padrão MAD, já aplicada ([[nomenclatura-mad]])

## Relacionadas

- [[mapa-do-repositorio]] — as pastas e os arquivos que não se leem inteiros
- [[scripts-e-checagens]] — onde está o `check:docs`
- [[fluxo-git-e-prs]] — documentação muda no mesmo PR do código
