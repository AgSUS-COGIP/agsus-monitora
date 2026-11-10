---
tags:
  - tipo/desenho
  - area/front
  - area/aprovados
---

# Organização por módulo — desenho

Data: 10/11/2026. Situação: proposta, piloto em Aprovados.

## Por quê

O código está difícil de ler porque as peças de um mesmo módulo ficam espalhadas e sem ligação
visível:

- **Regras:** `src/lib/` tem 226 arquivos soltos na raiz e mais de 2.300 funções exportadas, sem
  nada que separe o interno do que é para uso de fora. Qualquer arquivo importa qualquer função.
- **Contexto:** nenhuma das 25 pastas de `src/modulos/` tem `CLAUDE.md` (17 têm `README.md`). O
  Claude Code lê o `CLAUDE.md` da pasta onde trabalha; sem ele, falta contexto do módulo.
- **Testes:** todos estão em `tests/` (nenhum fora), mas 288 soltos na raiz e o resto separado por
  camada (`lib/`, `componentes/`, `modulos/`, `tipos/`). Os testes de Aprovados estão em seis
  lugares.

O objetivo é **legibilidade e organização**: abrir as pastas de um módulo e ver tudo dele, com uma
porta de entrada que diz o que ele oferece e um `CLAUDE.md` que dá o contexto.

## Objetivos

Cada módulo, ao ser organizado, fica com **tudo numa pasta só**, e os testes na pasta central:

```
src/modulos/<modulo>/
  CLAUDE.md             contexto do módulo
  *.tsx, estado.ts…     telas e estado (como hoje)
  regras/               lógica pura do módulo (hoje em src/lib/) + index.ts (porta de entrada)
tests/<modulo>/         todos os testes do módulo
```

`src/lib/` fica só com o que é realmente compartilhado entre módulos: sessão e auth, cliente
Supabase e `rpc-contrato.ts`, segurança (`sanitize.ts`, `html-security.ts`…), planilhas, mapas e
geografia comuns, utilidades.

- Fazer **módulo por módulo, cada um completo**, começando pelo piloto Aprovados. Avaliar o
  resultado antes de seguir para o próximo.
- `tests/` continua sendo a única pasta de testes do projeto (pedido do usuário: centralizar).

## Fora do escopo

- Reescrever lógica, renomear funções ou mudar comportamento. É mudança de lugar e de fronteira.
- Classes de serviço e herança no front (descartadas, ver Abordagens).
- Código Python (`python/monitora/`) e os testes Python (`tests/python/`, ver Decisões).
- Mover o legado `src/modules/`: segue o plano de `docs/arquitetura-react.md`.
- Os outros 24 módulos: cada um vem depois do piloto aprovado, com a mesma receita.

## O que tornaria isto um fracasso

- Um `index.ts` que reexporta tudo (`export *`): troca de lugar sem encapsular nada.
- Um único PR gigante movendo tudo de uma vez: conflito com quem trabalha em paralelo
  (`arquitetura-react.md`: "a mudança de pasta acontece módulo a módulo").
- Testes alterados para passar, em vez de só terem o caminho de importação atualizado. A mesma
  quantidade de testes tem de rodar antes e depois.
- `CLAUDE.md` e `README.md` dizendo a mesma coisa em dois lugares, ou `CLAUDE.md` longo que repete
  o código.

## Restrições

- `src/lib/CLAUDE.md`: lib é lógica pura, sem DOM e sem estado global. **A mesma regra vale para
  `regras/`**: as regras mudam de lugar, não de natureza (sem React, sem DOM, sem estado global;
  entrada → saída, com teste).
- **Muda uma regra da arquitetura (decisão do usuário):** a regra 2 de `docs/arquitetura-react.md`
  diz "regras em `src/lib/`". Passa a dizer: regras de um módulo em `src/modulos/<modulo>/regras/`;
  em `src/lib/` só o que é compartilhado. Atualizar junto: `docs/arquitetura-react.md`, o `CLAUDE.md`
  da raiz (Regras do código: "lógica pura em `src/lib/` + teste"; Mapa; linha "Lista de
  aprovados"), `src/lib/CLAUDE.md` e `src/modulos/README.md`.
- Caminhos de arquivo são citados em `CLAUDE.md`, `docs/`, na base da Aya e em configurações. Mover
  exige busca no repositório inteiro e `npm run aya:conhecimento` quando a base da Aya mudar.
- Configuração de testes hoje: Vitest pega `tests/**/*.test.{js,ts,tsx}`; Playwright pega
  `tests/**/*.spec.js`; os testes de tipos `tests/tipos/**/*.tsx` são conferidos pelo
  `tsconfig.frontend.json` (`include`) e excluídos do `tsconfig.tests.json`; pytest usa
  `testpaths = tests/python`.
- Precisa passar: `npm run typecheck`, `npm test`, `npm run lint`, `npm run check:architecture`,
  `npm run build`.

## Abordagens

1. **Agrupar por módulo, com porta de entrada (escolhida).** Pasta por módulo + `index.ts` +
   checagem de importação. Encapsula sem reescrever, os testes continuam valendo, dá para fazer em
   partes.
2. **Classes de serviço por módulo** (`new ServicoDeAprovados()`). Também encapsula, mas obriga a
   reescrever milhares de funções e testes, e no React ainda precisaria de hooks por cima.
3. **Hierarquias com herança.** Descartada: o front é React com hooks, feito para compor funções;
   herança deixaria o código menos legível.

O usuário escolheu a 1. Sobre a ordem, considerei três projetos separados (toda a `lib/`, depois
todos os `CLAUDE.md`, depois todos os testes) e propus **um módulo completo por vez**, que mantém
cada PR pequeno e entrega um módulo inteiro organizado a cada passo. Para os testes, considerei
`tests/<modulo>/` e testes dentro da pasta do módulo (`src/modulos/<modulo>/testes/`); o usuário
escolheu **`tests/<modulo>/`**. Para as regras, considerei `src/lib/<modulo>/` (respeita a regra 2
atual) e `src/modulos/<modulo>/regras/` (tudo do módulo numa pasta); o usuário pediu para
"centralizar mais" e escolheu **`src/modulos/<modulo>/regras/`**. Também considerei mover os testes
Python para `tests/<modulo>/`; não escolhido.

## Piloto: Aprovados

### 1. Regras: `src/modulos/aprovados/regras/`

Arquivos de `src/lib/` que vão para a pasta (levantamento de 10/11/2026):

| Arquivo hoje | Usado por (fora de `tests/`) |
|---|---|
| `aprovados-e-cronograma-da-api.ts` | só testes |
| `aprovados-import.ts`, `tipos-da-importacao-de-aprovados.ts` | `modulos/aprovados` |
| `candidatos-aprovados-compactos.ts` | `modulos/aprovados` |
| `carta-de-convocacao.ts`, `carta-de-convocacao-documento.ts`, `dados-da-carta.ts`, `tipos-da-carta.ts` | `modulos/aprovados`, base da Aya |
| `dados-da-publicacao-de-aprovados.ts`, `publicacao-de-aprovados.ts`, `tipos-da-publicacao-de-aprovados.ts` | `modulos/aprovados`, `modulos/classificacao` |
| `dados-do-estado-de-aprovados.ts`, `tipos-do-estado-de-aprovados.ts` | `modulos/aprovados` |
| `dados-do-historico-de-publicacoes.ts` | `modulos/aprovados` |
| `lista-aprovados-rules.ts`, `tipos-das-regras-de-aprovados.ts` | `modulos/aprovados` |
| `lista-convocacao-rules.ts`, `tipos-da-lista-de-convocacao.ts` | `modulos/aprovados`, `lib/classificacao` |
| `ordem-dos-aprovados.ts` | `modulos/aprovados` |
| `configuracao-de-convocacao.ts`, `modelo-de-convocacao.ts` | `modulos/aprovados`, `lib/classificacao`, base da Aya |
| `dados-da-configuracao-de-convocacao.ts`, `tipos-da-configuracao-de-convocacao.ts` | par de `configuracao-de-convocacao.ts` (incluídos por mim: confirmar os importadores) |
| `anexos-do-candidato.ts` | `modulos/aprovados` |

São 24 arquivos. Ficam de fora, por serem de outro módulo: `lista-do-painel-de-analises.ts`
(Análises), `publicacao-de-configuracoes.ts` (Configurações) e `convocacao-da-entrevista.ts`
(Entrevistas).

**Decisão do usuário: a Convocação fica dentro de Aprovados**, não numa pasta própria. O
`lib/classificacao` (`convocacao-do-edital.ts`, `dados-do-motor.ts`) passa a importar essas regras de
`modulos/aprovados/regras`, pelo `index.ts`. Alternativa não escolhida: pasta própria para a
Convocação.

Consequência a aceitar no piloto: `src/lib/classificacao/` (ainda não organizado) passa a depender
de `src/modulos/aprovados/regras/`. É uma dependência entre regras de dois módulos, permitida pela
porta de entrada; ela deixa de cruzar `lib → modulos` quando Classificação for organizada e suas
regras forem para `src/modulos/classificacao/regras/`.

Dependências conferidas em 10/11/2026:

- O conjunto **importa do compartilhado** (corrigido no plano; a primeira conferência estava errada):
  `access-roles.ts`, `csv-security.ts`, `editais-da-api.js`, `documento-da-resposta.ts`,
  `lib/classificacao/` (`documento-sei.ts`, `documento-docx.ts`, `tipos-dos-documentos.ts`) e, só como
  tipo, `src/ui/botao-de-acao.tsx` (`EstadoDaAcao`, em `tipos-da-carta.ts` e
  `tipos-da-configuracao-de-convocacao.ts`). Esses arquivos ficam onde estão; o import de tipo de
  `.tsx` é permitido em `regras/` (apagado na compilação). Há dependência nos dois sentidos com
  `lib/classificacao/`; o plano confere que não vira ciclo de execução.
- Quem importa de fora: `modulos/aprovados`, `modulos/classificacao` (`estado.ts`,
  `publicar-aprovados.tsx`) e `lib/classificacao`. Nada em `src/modules/` nem em `src/componentes/`
  importa o conjunto (o gerado da Aya só cita caminhos em texto).
- Nenhuma pasta atual de `src/lib/` (`classificacao/`, `avaliacao-documental/`…) tem `index.ts`.

### 2. Contexto: `src/modulos/aprovados/CLAUDE.md`

O `README.md` atual de `src/modulos/aprovados/` **vira o `CLAUDE.md`** (renomear e completar), para
não haver dois textos. Conteúdo, curto:

- o que o módulo faz e a rota (`/<área>/aprovados`);
- mapa dos arquivos da pasta (uma linha cada);
- o que há em `regras/`: o que o `index.ts` oferece, a regra de pureza (sem React, sem DOM) e o
  critério dos nomes;
- onde estão os testes (`tests/aprovados/`), com o comando para rodar só eles;
- regras e cuidados que valem só para este módulo (os que já estão no README ou no `CLAUDE.md` da
  raiz).

Um `CLAUDE.md` só por módulo, na raiz da pasta do módulo; `regras/` não ganha outro. O `CLAUDE.md`
da raiz (linha "Lista de aprovados") passa a apontar para `src/modulos/aprovados/` e
`tests/aprovados/`.

### 3. Testes: `tests/aprovados/`

Todos os testes do módulo vão para `tests/aprovados/`, mantendo o tipo no nome ou numa subpasta:

```
tests/aprovados/
  *.test.ts / *.test.js     testes de regra, de componente e de tela, juntos
  tipos/*.tsx               testes de tipos (hoje em tests/tipos/)
  apoio/                    arquivos de apoio só deste módulo (ex.: abertura-dos-aprovados.ts,
                            modelos-de-convocacao-antigos.ts)
```

Candidatos levantados em 10/11/2026 (o critério final é **o que o teste importa**: vai para
Aprovados o teste que importa principalmente `modulos/aprovados`, inclusive `regras/`):

- raiz de `tests/`: `anexos-do-candidato`, `aprovados-e-cronograma-api`,
  `candidatos-aprovados-compactos`, `convocacao-mgi-e-saude-indigena`,
  `lista-aprovados-filtros-multiplos`, `lista-aprovados-paginacao`,
  `lista-convocacao-regras-do-edital`, `lista-convocacao-rules`, `modelo-de-convocacao`,
  `ordem-dos-aprovados`, `modelos-de-convocacao-antigos.ts`;
- `tests/componentes/`: `abertura-dos-aprovados.ts`, `campos-dos-aprovados`, `convocado-e-carta`,
  `lista-aprovados`, `lista-de-convocacao`;
- `tests/lib/`: `carta-de-convocacao`, `configuracao-da-convocacao-dados`,
  `contratado-em-outra-lista`, `convocacao-sub-judice-por-edital`,
  `dados-da-publicacao-de-aprovados`, `dados-do-estado-de-aprovados`, `historicos-dos-aprovados`,
  `importacao-xlsx-de-aprovados`, `publicacao-de-aprovados`;
- `tests/modulos/`: `carta-confirmacao-e-modelos`, `carta-de-convocacao-troca-de-area`,
  `ordem-dos-territorios` (conferir);
- `tests/tipos/`: `aba-e-regras-de-aprovados`, `base-dos-aprovados`, `cartas-e-navegador`,
  `configuracao-da-convocacao`, `estado-dos-aprovados`, `lista-de-convocacao`,
  `modais-dos-aprovados`.

Ficam onde estão: `convocacao-da-entrevista.test.js` e `tipos/convocacao-de-entrevistas.tsx`
(Entrevistas), `lib/classificacao-convocacao-do-edital.test.js` (testa `lib/classificacao`; vai com
Classificação), `tests/fixtures/` e `tests/setup/` (compartilhados).

Configuração que muda: os testes de tipos passam a ser achados por `tests/**/tipos/**/*.tsx` no
`include` do `tsconfig.frontend.json` e no `exclude` do `tsconfig.tests.json`, para valer para
`tests/tipos/` e para cada `tests/<modulo>/tipos/`. Vitest e Playwright já pegam subpastas.

## Decisões tomadas (chamadas minhas, a conferir)

- **Checagem por ESLint** (`no-restricted-imports` com `patterns`), já instalado, em vez de um
  script novo: fora de `src/modulos/<modulo>/`, proíbe importar `modulos/<modulo>/regras/*` e
  permite `modulos/<modulo>/regras` (o `index.ts`). Vale para todo `src/`, **inclusive
  `src/lib/`**. A regra lista **só os módulos que já têm `regras/index.ts`** (no piloto, só
  `aprovados`); cada módulo entra na lista quando for organizado. Importar telas de outro módulo
  fica como está hoje (fora do escopo).
- **Pureza de `regras/` também checada no ESLint:** arquivos de `src/modulos/*/regras/**` não podem
  importar `react`, `react-dom` nem arquivos de tela do módulo (`.tsx`), exceto `import type`. Sem
  isso, a pasta das regras tende a virar mais um lugar de tela.
- **Testes podem importar o interior** da pasta: são testes de unidade das regras. A checagem
  ignora `tests/` inteiro.
- **O que o `index.ts` exporta sai do uso real:** exatamente os nomes que algum arquivo de `src/`
  fora da pasta importa hoje (telas, `lib/classificacao`). Uso só por testes não conta. Sem
  `export *`.
- **Base da Aya entra no escopo:** `docs/aya/regras-da-lista-de-aprovados.md` (16 citações),
  `regras-da-classificacao.md` e `regras-dos-editais.md` (1 cada) citam os caminhos antigos no campo
  `fonte`; atualizar os `.md` e rodar `npm run aya:conhecimento`. Nenhum teste confere esses
  caminhos, então a conferência é por busca no repositório.
- **Testes Python ficam em `tests/python/`**: o pytest e o pacote `python/monitora/` estão
  organizados por pasta própria, e `tests/` já é a pasta central. O único de Aprovados
  (`test_contratacao_dos_aprovados.py`) não se move.
- **Nomes dos arquivos movidos perdem o sufixo repetido** só quando o ganho for claro
  (`lista-aprovados-rules.ts` → `regras/lista.ts`?) — **deixado ao construtor**, com o mesmo
  critério para todos e escrito no `CLAUDE.md` do módulo. Vale para os testes também.
- `tests/CLAUDE.md` e `src/lib/CLAUDE.md` ganham a regra nova ("teste de módulo organizado vai em
  `tests/<modulo>/`"; "regra de um módulo só vai em `src/modulos/<modulo>/regras/`; `src/lib/` é
  para o compartilhado").
- **Critério de "compartilhado"** para os próximos módulos: arquivo de `src/lib/` usado por telas
  de dois ou mais módulos fica em `src/lib/`; usado por um só vai para o `regras/` dele. No piloto
  não há caso de dúvida: os 24 arquivos são de Aprovados (a Classificação usa pela porta de
  entrada, por decisão do usuário).

## Deixado ao construtor

- A ordem dos commits do piloto (sugestão: regras, depois testes, depois `CLAUDE.md`), e se os
  caminhos antigos ganham reexportação temporária (só se ajudar a dividir o PR; tem de sair no
  mesmo PR).
- O formato exato da regra do ESLint.
- Conferir a contagem de testes antes e depois (`npx vitest run` com o mesmo total).
- Depois do piloto: a ordem dos próximos módulos, combinada com o usuário.
