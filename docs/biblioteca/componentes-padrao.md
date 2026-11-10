---
tipo: referencia
area: front
atualizado: 2026-11-10
---

# Componentes padrão (`src/ui/`)

O design system em React: toda tela monta com estes componentes e os tokens. A API completa (uma
linha por componente) está em [docs/arquitetura-react.md](../arquitetura-react.md), "Como usar
`ui/`"; aqui, o que existe e as regras de uso.

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

| Grupo            | Componentes                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Topo e filtros   | `TopoDoPainel`, `PainelDeFiltros`, `ChipsDeFiltro`/`ChipDeFiltro`, `MaisOpcoes`, `LinhaDoRecorte`/`MarcasDoRecorte` |
| Indicadores      | `Kpi` (card de 78px; com `aoClicar` vira filtro), `GradeDeKpis`, `FaixaDeSituacao`, `ListaDePendencias` |
| Gráficos         | `CardDeGrafico`, `Grafico` (Chart.js criado uma vez), `paletaDosGraficos` (cores dos tokens)    |
| Listas e tabelas | `TabelaInfinita` (50 por vez, avisa `agsus:content-updated`), `CardDaLista` + `TabelaDaLista`, `BarraDaLista` |
| Camadas          | `Gaveta`, `TopoDaGaveta`, `Modal` (portal, Esc, foco preso), `Popover`, `MenuDeAcoes`           |
| Detalhe          | `Secao`, `Kv`, `GradeDeKv`                                                                     |
| Formulário       | `Campo` (liga o rótulo ao controle), `Segmentado` (radiogroup), `Abas` (tablist)                |
| Estados          | `EstadoVazio`, `Carregando`, `ErroAoCarregar`, `LinhasEsqueleto`, `BlocosEsqueleto`, `Aviso`, `Selo` |
| Ações            | `BotaoDeAcao` (ação que escreve no banco), `AcoesDaLinha`                                       |
| Telas da seleção | `CabecalhoDaTela`, `BarraDaLista`, `FaixaDeSituacao`, `CardDaLista`                             |
| Utilitários      | `usarEstadoDaSessao` (filtros voltam no F5), `classes(...)`                                    |

Peças de layout só em CSS: `.ui-tela`, `.ui-card`, `.ui-titulo`, `.ui-linha-de-cards`,
`.ui-pilha`, `.ui-grade-de-campos`, `.ui-acoes`, `.ui-barra-de-salvar`, `.ui-gaveta-*`,
`.ui-texto-principal`/`.ui-texto-secundario`, `.ui-secao-texto`/`.ui-secao-vazio`, `.ui-esqueleto`,
`.btn.small`/`.btn.danger` dentro de `.ui-tela`/`.ui-gaveta`, `.btn.ghost` e `.btn.perigo`.

## Fora de `ui/` (ainda em `src/componentes/`)

- `icone.tsx` — `<Icone nome="…">`, Lucide, do registro de `src/modules/icones.ts` ([[icones]]).
- `multi-select-busca.tsx` — `<MultiSelectBusca>`: seleção múltipla com busca, controlada (a única
  do app; CSS em `src/styles/multi-select-busca.css`).
- `selo-de-treinamento.tsx` — selo "Treinamento" do edital de treinamento.
- `seletor-de-edital.tsx` — a escolha do edital das telas da seleção (Triagem, Avaliação
  documental, Classificação), com selo e "Mostrar todos".
- `pessoas-online/` ("Pessoas online" no cabeçalho, estado em `src/app/presenca.ts`) e
  `aviso-de-versao/` (faixa "Há uma versão nova", regra em `src/app/aviso-de-versao.ts`): filhas da
  casca. `usar-area-atual.ts`: hook da área atual, suas linhas e os ids dos editais.

`icone.tsx` e `multi-select-busca.tsx` vão para `src/ui/` ao serem tocados.

## Relacionadas

- [[design-e-tokens]] — tokens e regras de ouro
- [[nova-tela-react]] — como a tela usa os componentes
- [[textos-da-interface]] — estados vazios e de erro curtos
- [[testes]] — teste de componente em `tests/ui/`
