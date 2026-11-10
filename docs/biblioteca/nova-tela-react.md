---
tipo: guia
area: front
atualizado: 2026-11-10
---

# Nova tela em React

Tela ou feature nova é **React**: módulo em `src/modulos/<nome>/`, tela de página inteira como
rota, visual com `src/ui/` e tokens, lógica pura em `src/lib/` com teste. Nada novo em
`src/modules/` nem em `src/analises/` ([[codigo-legado]]). Detalhes em
[docs/arquitetura-react.md](../arquitetura-react.md), "Como criar um módulo novo" e "Como montar".

## A pasta

```
src/modulos/<nome>/
  <nome>.tsx      componente da tela + criar<Nome>() ({ conteudo, nome, render() }), rota em src/app/telas.tsx
  estado.ts       store sem React: obter(), assinar(ouvinte) e as ações (RPC)
  consultas.ts    (opcional) as RPCs do módulo, se o estado ficar grande
  <nome>.css      (opcional) só o que é desta tela; o resto vem de src/ui/
src/lib/<nome>.ts               regras puras
tests/modulos/<nome>.test.ts    teste do componente (sem JSX, com act)
tests/<nome>.test.ts            teste das regras de src/lib/
```

Nomes em português, arquivo em kebab-case, componente em PascalCase. Modelos de tela de página
inteira: `src/modulos/recursos/`, `selecao/`, `entrevistas/`, `analises/`.

## Como entra no app

- O módulo exporta `criar<Nome>(opcoes)`, sem DOM, que devolve `{ estado, nome, conteudo,
  render() }` (`nome` aparece no console se a tela quebrar; `render()` roda a cada abertura).
- A tela entra em `src/app/telas.tsx` (`registrarTelasDoApp`: `criar` no pacote principal ou
  `carregar: () => import(…)` sob demanda) e em `src/lib/rotas.ts` (view, caminho, título). A rota
  desenha a `<section id="page-<view>">`, põe a tela num `ErrorBoundary` e a mantém montada.
- Quem precisa de outra tela usa o registro (`carregarTela(view)`, `src/app/registro-das-telas.ts`),
  nunca `window`. Título e área ficam no cabeçalho; a tela não repete. Área de
  `usarAreaAtual()`/`obterDadosDoMonitoramento()`, tema de `usarTemaEscuro()` (`src/app/tema.ts`).
- **Seção de Configurações** (modelos `src/modulos/acessos/` e `src/modulos/modulos/`): rota
  `/administracao/configuracoes/<seção>`, registrada como `secao:<id>`, com `confirmarSaida()`
  para rascunho ([[modulo-configuracoes]]).
- Parte fixa do app (cabeçalho, topo, overlay) é filha da casca (`src/app/casca/`); pedaço React
  dentro de DOM feito à mão entra por `abrirPortalAvulso` (`src/app/portais-avulsos.tsx`). **Nada
  de `createRoot` novo.**
- Página nova ou área nova no menu: `src/lib/menu-lateral.ts` ([[modulo-barra-lateral]]); quem vê,
  `src/lib/access-roles.ts` ([[permissoes-e-perfis]]).

## Regras do componente

- `estado` não importa React (o legado também pode importá-lo); o que é só da tela (filtro, aba,
  página, rascunho) é estado do componente.
- RPC nova ou mudada → `src/lib/rpc-contrato.ts` ([[rpc-e-contrato]]).
- `StrictMode` ligado: efeito tem de limpar o que instala.
- Sem `innerHTML` e sem `dangerouslySetInnerHTML`: texto vai como filho.
- Modal em React é sempre `<Modal>` (portal): um modal dentro da `<section>` sumiria com a página
  escondida.
- Campo cujo texto não é o valor (número, lista separada por `;`) usa `CampoEditavel`
  (`src/modulos/aprovados/partes.tsx`): amarrar o `value` ao valor lido apaga o que a pessoa digita.
- Tabela nova avisa `agsus:content-updated` depois de desenhar: é o que põe os rótulos do modo
  cartão (`src/app/casca/tabelas-em-cartoes.ts`, ≤ 900px; [[mobile]]).
- Handler de navegação chama `window.navigate` **na hora do clique** (não guarde a referência na
  montagem): é o `navigate` do legado, que pergunta às Configurações antes de sair.
- Componente entra em `src/ui/` quando duas telas ou mais repetem a mesma peça.
- Nota de documentação: `docs/biblioteca/modulo-<nome>.md` a partir de `docs/_templates/modulo.md`
  ([[documentacao]]).

## Ao migrar uma tela do legado

Levante tudo o que a antiga faz (checklist), cumpra com testes, confira no navegador e só então
apague o legado ([[codigo-legado]]).

## Relacionadas

- [[arquitetura-do-front]] — o alvo e as regras gerais
- [[componentes-padrao]] — os componentes de `src/ui/`
- [[legado-fala-com-react]] — quando o legado ainda conversa com a tela
- [[testes]] — como testar componente React sem JSX
