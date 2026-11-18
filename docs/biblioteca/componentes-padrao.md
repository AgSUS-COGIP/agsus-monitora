---
tipo: referencia
area: front
atualizado: 2026-11-17
---

# Componentes padrão (`src/ui/`)

O design system em React: toda tela monta com estes componentes, os tokens e os ícones Lucide. A
API completa (uma linha por componente) está em [docs/arquitetura-react.md](../arquitetura-react.md),
"Como usar `ui/`"; aqui, o que existe e as regras de uso.

## Uso

- Índice em `src/ui/index.ts`; `ui.css` só com tokens; `Modal` em `src/ui/modal.tsx` (e o
  `modal-institucional.tsx`).
- Importe do índice: `import { Kpi, GradeDeKpis, Aviso } from "../../ui/index.ts";`.
- O `ui.css` é importado uma vez em `src/main.ts`. O CSS próprio de um módulo aberto sob demanda é
  importado pelo ponto de entrada da tela; só fica no `main.ts`, depois do `ui.css`, o CSS de
  módulo cujas classes aparecem fora da própria tela.
- Os componentes emitem só classes `.ui-*` (para não colidir com `.panel`, `.kpi`, `.card` do
  `app.css`) e nenhum id fixo.
- **Componente entra em `ui/` quando duas telas ou mais repetem a mesma peça**; o que é de uma
  tela só fica no módulo. Não recrie em cada tela.

## O que existe

| Grupo            | Componentes                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topo e filtros   | `TopoDoPainel`, `PainelDeFiltros`, `ChipsDeFiltro`/`ChipDeFiltro`, `MaisOpcoes`, `LinhaDoRecorte`/`MarcasDoRecorte`                                                                                               |
| Indicadores      | `Kpi` (card de 78px; com `aoClicar` vira filtro), `GradeDeKpis`, `FaixaDeSituacao`, `ListaDePendencias`                                                                                                           |
| Gráficos         | `CardDeGrafico`, `Grafico` (Chart.js criado uma vez), `paletaDosGraficos` (cores dos tokens)                                                                                                                      |
| Listas e tabelas | `TabelaInfinita` (50 por vez, avisa `agsus:content-updated`), `CardDaLista` + `TabelaDaLista`, `BarraDaLista`, `usarCargaContinua` + `MaisDaCarga`                                                                |
| Camadas          | `Gaveta`, `TopoDaGaveta`, `Modal` (portal, Esc, foco preso), `Popover`, `MenuDeAcoes`                                                                                                                             |
| Detalhe          | `Secao`, `Kv`, `GradeDeKv`                                                                                                                                                                                        |
| Formulário       | `Campo` (liga o rótulo ao controle), `Segmentado` (radiogroup), `Abas` (tablist), `ContagemDaAba` (o número no rótulo)                                                                                            |
| Estados          | `EstadoVazio`, `Carregando`, `CarregandoConteudo`, `ErroAoCarregar`, `LinhasEsqueleto`, `BlocosEsqueleto`, `Aviso`, `Selo`                                                                                        |
| Ações            | `BotaoDeAcao` (ação que escreve no banco), `AcoesDaLinha`                                                                                                                                                         |
| Seleção em lote  | `BarraDeSelecao` ("Selecionar esta página (N)" ≠ "Selecionar todos os N resultados"; a página vem de `aoMostrar` da tabela; textos em `lib/base/alcance-da-selecao.ts`, a confirmação diz quantos serão afetados) |
| Telas da seleção | `CabecalhoDaTela`, `BarraDaLista`, `FaixaDeSituacao`, `CardDaLista`                                                                                                                                               |
| Utilitários      | `usarEstadoDaSessao` (filtros voltam no F5), `classes(...)`                                                                                                                                                       |

Prazos: `SeloDePrazo` diz quanto falta para uma data ("Vence em 12 dias", "Venceu há 3 dias") com
o tom da faixa (vencido, menos de 30, 90 ou 180 dias); a lógica é `src/lib/base/prazos.ts`.

Gráficos: o `Grafico` dentro do `CardDeGrafico` traz a tabela dos valores (leitor de tela e botão
"Tabela" do título) e percorre os itens pelas setas; nada a fazer em quem usa
(`src/ui/tabela-do-grafico.tsx`, DS 13.5).

Exportação: toda tabela exporta por `BotoesDeExportacao` — "Exportar em Excel" (.xlsx) e "Salvar
em PDF", sempre com esse nome e nessa ordem — no topo da tela (`TopoDoPainel` `exportacao`), no
rodapé da lista (`TabelaDaLista` `exportacao`, ao lado de "Mostrando N de M") ou na barra da tabela. O arquivo sai de `src/lib/base/exportacao-da-tabela.ts` (`arquivoDaTabela`), a
partir do mesmo retrato (título, colunas e linhas); `baixarArquivo` entrega.

Nas telas com `CabecalhoDaTela` (`tituloNaTela` em `src/lib/navegacao/rotas.ts`: Conduzir entrevistas,
Classificação, Avaliação documental e Triagem), a faixa do topo do app (`header.top`) fica compacta
(`data-compacto`, só a partir de 901px): sem o título, que é o da tela, e com a conta menor, o perfil
só dentro do menu (`src/app/casca/topo.tsx`).

Peças de layout só em CSS: `.ui-tela`, `.ui-card`, `.ui-titulo`, `.ui-linha-de-cards`,
`.ui-pilha`, `.ui-grade-de-campos`, `.ui-acoes`, `.ui-barra-de-salvar`, `.ui-gaveta-*`,
`.ui-texto-principal`/`.ui-texto-secundario`, `.ui-secao-texto`/`.ui-secao-vazio`, `.ui-esqueleto`,
`.btn.small`/`.btn.danger` dentro de `.ui-tela`/`.ui-gaveta`, `.btn.ghost` e `.btn.perigo`.

## Fora de `ui/` (ainda em `src/componentes/`)

- `icone.tsx` — `<Icone nome="…">`, Lucide, do registro de `src/modules/icones.ts` (ver Ícones).
- `multi-select-busca.tsx` — `<MultiSelectBusca>`: seleção múltipla com busca, controlada (a única
  do app; CSS em `src/styles/multi-select-busca.css`).
- `selo-de-treinamento.tsx` — selo "Treinamento" do edital de treinamento.
- `seletor-de-edital.tsx` — a escolha do edital das telas da seleção (Triagem, Avaliação
  documental, Classificação), com selo e "Mostrar todos".
- `pessoas-online/` ("Pessoas online" no menu da conta, estado em `src/app/presenca.ts`) e
  `aviso-de-versao/` (faixa "Há uma versão nova", regra em `src/app/aviso-de-versao.ts`): filhas da
  casca. `usar-area-atual.ts`: hook da área atual, suas linhas e os ids dos editais.

`icone.tsx` e `multi-select-busca.tsx` vão para `src/ui/` ao serem tocados.

## Lista longa não se desenha inteira

Lista que pode passar de algumas centenas (convocados, fichas, vínculos, pendências) desenha 50
por vez e mais 50 ao rolar: `TabelaInfinita` ou `TabelaDaLista` para tabela simples; para blocos
por dia ou por vaga e cartões, `usarCargaContinua(recorte, total)` + `MaisDaCarga` depois da lista,
com `gruposAteOLimite` (`src/lib/carga/carga-continua.ts`) cortando os blocos. O `recorte` é estável
(lista memorizada ou chave dos filtros): recriado a cada desenho, a lista volta sempre aos 50.
Exportação continua com tudo. Guarda: `tests/casca-sessao-e-interface-na-tela.test.ts` (bloco `ui/carga-continua`).

## Carregando não é cartão em branco

Bloco que espera uma leitura (o edital escolhido, a fila, a regra…) usa
`CarregandoConteudo` com o que está carregando por escrito ("Carregando o edital 93/2026…"):
indicador girando, linhas de esqueleto e `role="status"`; `semMoldura` dentro de um cartão.
Nunca um `.ui-card` com `.ui-esqueleto-linha` soltas: até 10/11/2026 elas não tinham a classe
base e a tela ficava segundos num cartão vazio (#732). Guarda: `tests/casca-sessao-e-interface-na-tela.test.ts` (bloco `ui/carregando-conteudo`).

## Ícones

**Todo o sistema desenha Lucide**; o Font Awesome não é mais carregado. Dois caminhos:

- **Barra lateral e o que é dela** (Sair, tema, botão de recolher e o ☰ do celular) e componente
  reescrito: SVG Lucide de verdade, pelo registro.
- **Resto do sistema:** o HTML e os módulos ainda escrevem `<i class="fa-solid fa-…">`, e
  `src/styles/icones-lucide.css` desenha em cada classe o ícone Lucide equivalente.

Onde fica:

- `src/modules/icones.ts` — **registro único** dos ícones Lucide, que importa cada ícone pelo nome
  (só os usados entram no bundle). Ícone novo: registre lá. Sem framework,
  `criarIcone(nome, { tamanho })`; em React, `<Icone nome="…" tamanho={…} />`
  (`src/componentes/icone.tsx`). Não misture dois conjuntos no mesmo componente.
- `src/lib/base/mapa-de-icones-lucide.ts` — o mapa Font Awesome → Lucide (`FA_PARA_LUCIDE`).
- `src/styles/icones-lucide.css` — **gerado** por `npm run icones`
  (`scripts/gerar-icones-lucide.mjs`): cada classe `fa-…` vira uma máscara no `::before` do `<i>`
  (`mask-image` com o SVG, `background-color: currentColor`), então segue a cor do texto.
  `img-src data:` já é permitido pela CSP (`vercel.json`). Ícone novo com classe `fa-…`: acrescente
  o par no mapa e rode `npm run icones`; `tests/editais-cargas-e-paineis.test.js` (bloco `icones-lucide`) falha se faltar. Não edite o
  CSS à mão.

Regras:

- Tamanhos 16, 18 e 20px, traço 1,75, na cor do texto ao lado (`stroke: currentColor`).
- O ícone é decorativo (`aria-hidden`); quem nomeia o controle é o texto dele ou um `aria-label`.
  Botão só com ícone: `aria-label` + `title` e alvo de 40×40 ([[acessibilidade-e-mobile]]).
- Nenhum emoji no lugar de ícone (Design System, seção 14).
- Ao reescrever um componente, prefira o registro à classe `fa-…`.

## Relacionadas

- [[design-e-tokens]] — tokens e regras de ouro
- [[nova-tela-e-legado]] — como a tela usa os componentes
- [[acessibilidade-e-mobile]] — foco, alvos de toque e tabelas em cartões
- [[textos-da-interface]] — estados vazios e de erro curtos
- [[ci-e-qualidade]] — os geradores, como o de ícones
- [[testes]] — teste de componente em `tests/ui/`
