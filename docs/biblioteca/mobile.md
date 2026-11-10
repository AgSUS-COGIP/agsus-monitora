---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Mobile e responsividade

A interface funciona em desktop, notebook, tablet e celular. Não basta diminuir os componentes:
reorganize a tela. Fonte: `DESIGN.md` (3.8) e [Design System AgSUS](../design-system-agsus.md),
seção 16.

## Breakpoints do MONITORA

Media query não aceita `var()`, então os valores são constantes documentadas:

- **420px** — celular pequeno
- **640px** — celular
- **900px** — tablet; a barra lateral vira gaveta (contrato com
  `src/componentes/barra-lateral/usar-ambiente.ts`) e as tabelas viram cartões
- **1220px** — desktop estreito

Os valores antigos (560, 680, 700, 720, 820, 1180) migram para o mais próximo quando a regra for
tocada.

## Comportamento esperado (Design System, seção 16)

| Elemento             | Desktop                    | Tablet (768–1023px)                    | Celular (< 768px)                            |
| -------------------- | -------------------------- | -------------------------------------- | -------------------------------------------- |
| Barra lateral        | expandida ou recolhida     | gaveta sobreposta                      | gaveta sobreposta                            |
| Padding da página    | 32px                       | 24px                                   | 16px                                         |
| Indicadores          | 4 colunas                  | 2 colunas                              | 1 coluna                                     |
| Ações do cabeçalho   | visíveis                   | principal visível; demais em "Mais ações" | idem                                      |
| Filtros              | em linha                   | busca e "Filtros (n)"                  | busca e "Filtros (n)"                        |
| Tabelas              | completas                  | rolagem horizontal, 1ª coluna fixa     | rolagem horizontal ou lista de itens         |
| Modais e gavetas     | centralizado / 480px       | centralizado / 480px                   | tela cheia ou folha inferior                 |

- Toque (`pointer: coarse`): controles com no mínimo 44 × 44px.
- Sem rolagem horizontal da página em 320px de largura e com zoom de 200% (WCAG 1.4.10); tabelas e
  gráficos rolam dentro do próprio contêiner. Nunca desabilitar o zoom.

## Como o MONITORA faz

- **Tabelas em cartões (≤ 900px):** `src/app/casca/tabelas-em-cartoes.ts` põe os rótulos do modo
  cartão; por isso toda tabela nova avisa `agsus:content-updated` depois de desenhar
  (`TabelaInfinita` já avisa). `CardDaLista` rola de lado no celular.
- CSS de celular em `src/styles/mobile-*.css` ([[css]]).
- A legenda do mapa nacional é recolhível e começa fechada abaixo de 768px.

## Relacionadas

- [[acessibilidade]] — alvos e zoom
- [[modulo-barra-lateral]] — a gaveta abaixo de 900px
- [[componentes-padrao]] — `TabelaInfinita`, `CardDaLista`
