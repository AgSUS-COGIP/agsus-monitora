# Arquitetura React do MONITORA

Status: **aprovada em 01/10/2026**. Etapa 1 (Fundação) feita; as demais, abaixo, em ordem.
Complementa `docs/arquitetura.md` (banco, áreas e permissões).

## Para onde o sistema vai

Um único app React, uma página, rotas por área.

```
src/
  app/        entrada única, rotas, layout (menu + topo + Aya), login, ErrorBoundary
  ui/         componentes visuais padrão (o design system)
  modulos/    um por tela: componentes + estado.js + consultas (RPC)
  lib/        regras puras, testadas
  legado/     o que ainda não migrou (encolhe até sumir)
```

## Regras

1. **Um visual só.** Toda tela monta com `src/ui/` e os tokens de `src/styles/tokens.css`. KPI
   é card compacto (`Kpi` em `GradeDeKpis`, ~78px de altura), não faixa sem card.
2. **Um padrão de dados só**, o que as telas React já usam: `estado.js` por módulo (store fora do
   React, com `obter()` e `assinar(ouvinte)`, lido com `useSyncExternalStore`), RPC pelo cliente
   Supabase único (`getSupabaseClient()`, contrato em `src/lib/rpc-contrato.js`), regras em
   `src/lib/`. Sem biblioteca nova de estado ou de dados.
3. **Isolamento.** Cada tela, seção e parte da casca fica dentro de um `ErrorBoundary` (a rota em
   `src/app/telas.tsx`, as peças em `src/app/casca/pecas.tsx`): erro numa tela mostra um aviso curto
   com "Tentar de novo" e não derruba o resto. Há um `createRoot` só (`src/app/raiz.tsx`).
4. **Texto.** Sem texto genérico ou explicativo na interface (quem explica é a Aya); sem selo
   "Somente consulta" (quem só lê não vê os controles de edição); a data da última carga
   aparece discreta e uma vez só (`.status-discreto`, no `TopoDoPainel`).
5. **Nada novo no legado.** Arquivo novo em `src/modules/` ou `src/analises/` quebra o
   `npm run check:architecture` (`scripts/check-legado-so-encolhe.mjs`). Editar e apagar podem.

## Ordem das etapas

| Etapa | O quê                                                                                |
| ----- | ------------------------------------------------------------------------------------ |
| 1     | **Fundação (feita):** `src/app/`, `src/ui/`, pastas `modulos/` e `legado/`, checagem |
| 2     | Entrevistas, Recursos e Seleção saem do iframe (**feita**)                           |
| 3     | Configurações (**feita**: `configuracoes/`, `acessos/`, `modulos/`; falta Status)    |
| 4     | Análises (**feita**: `src/modulos/analises/`)                                        |
| 5     | Visão geral: primeiro o que não é mapa, depois os mapas                              |
| 6     | Login e entrada (**fases 1 e 2 feitas**, ver abaixo; falta o layout em React)        |
| 7     | Aya                                                                                  |

A mudança de pasta acontece **módulo a módulo**, na etapa de cada um — mover tudo de uma vez
gera conflito com quem está trabalhando em paralelo.

## Onde está cada coisa hoje → para onde vai

| Hoje                                                                                                             | Alvo                                                      | Quando     |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| `src/app/` (`raiz.tsx`, `telas.tsx`, `navegacao.ts`, `ErrorBoundary.tsx`)                                        | fica (`montar-modulo.tsx` sai no passo 3 da raiz única)   | —          |
| `src/ui/` (design system)                                                                                        | fica                                                      | —          |
| `src/componentes/icone.tsx`, `multi-select-busca.tsx`                                                            | `src/ui/`                                                 | ao tocar   |
| Configurações (moldura, seções e `secoes.ts`), Acessos, Módulos e abas                                           | `src/modulos/configuracoes/`, `acessos/`, `modulos/`      | concluído  |
| `src/componentes/saude-das-cargas/` (Status das atualizações)                                                    | `src/modulos/`                                            | ao tocar   |
| Editais, Cronograma e Lista de aprovados                                                                         | `src/modulos/editais/`, `cronograma/`, `aprovados/`       | concluído  |
| `src/modules/map-*`, `health-*`, `indigenous-*`, (o dashboard já saiu do legado)                                 | `src/modulos/visao-geral/`                                | 5          |
| `src/main.ts`, `index.html`, `src/componentes/barra-lateral/`, `dados-do-monitoramento.ts`, `usar-area-atual.ts` | `src/app/` (entrada, layout, área atual)                  | 6          |
| `auth-storage.ts` (o login, o `legacy-app.js` e a marca da barra já saíram do legado)                            | `src/lib/`                                                | 6          |
| `src/modules/aya-*` (IA, base e memória; o painel já é `src/modulos/aya/`)                                       | `src/app/` (Aya no layout)                                | 7          |
| `src/lib/`                                                                                                       | fica                                                      | —          |
| `src/styles/tokens.css`                                                                                          | fica; os outros CSS vão com o módulo ou saem com o legado | cada etapa |

`src/modules/` **é** o legado de hoje (`src/analises/` ficou só com o `CLAUDE.md`: o painel de
Análises e o CSS do quadro saíram). `src/legado/` fica vazio por enquanto:
só recebe código antigo numa mudança em bloco combinada antes (ver `src/legado/README.md`).

## Como criar um módulo novo

```
src/modulos/<nome>/
  <nome>.tsx      componente da tela + criar<Nome>() ({ conteudo, nome, render() }), rota em src/app/telas.tsx
  estado.js       store sem React: obter(), assinar(ouvinte) e as ações (RPC)
  consultas.js    (opcional) as RPCs do módulo, se o estado.js ficar grande
  <nome>.css      (opcional) só o que é desta tela; o resto vem de src/ui/
src/lib/<nome>.js           regras puras
tests/modulos/<nome>.test.js  teste do componente (sem JSX, com act)
tests/<nome>.test.js          teste das regras de src/lib/
```

- `estado.js` não importa React (o legado também pode importá-lo). Componente lê com
  `useSyncExternalStore(estado.assinar, estado.obter)`; o que é só da tela (filtro, aba, página)
  é estado do componente.
- RPC nova ou mudada → `src/lib/rpc-contrato.js` (`npm run check:rpc-contract` quebra o build).
- Sem `innerHTML`/`dangerouslySetInnerHTML`; texto vai como filho.
- `StrictMode` está ligado: efeito tem de limpar o que instala.

## Como montar

**Uma raiz só** (`src/app/raiz.tsx`, `montarRaiz()` no começo de `src/main.ts`): o React monta em
`#raiz` e desenha, por portal, os avisos (`#avisosApp`), a tela de acesso (`#telaDeEntrada`) e a
casca (`#appScreen`: barra lateral, cabeçalho e as telas). O contexto do app
(`src/app/contexto-do-app.ts`) entrega a navegação e o aviso curto. Rotas, ordem dos passos e
riscos: **`docs/arquitetura/raiz-react.md`**.

**Tela de página inteira = rota** (modelos: `src/modulos/recursos/`, `src/modulos/selecao/`,
`src/modulos/entrevistas/`, `src/modulos/analises/`). O módulo exporta `criar<Nome>(opcoes)`, sem
DOM:

```tsx
export function criarTela({ supabase = getSupabaseClient(), toast } = {}) {
  const estado = criarEstadoDaTela({ supabase, toast });
  return {
    estado,
    nome: "a tela X", // aparece no console se a tela quebrar
    conteudo: <Tela estado={estado} />,
    render: () => estado.carregar(), // a cada abertura
    // abrirEdital(id) / abrirVisao(visao), se a tela abre por link
  };
}
```

A tela entra em `src/app/telas.tsx` (`registrarTelasDoApp`: `criar` no pacote principal ou
`carregar: () => import(…)` sob demanda) e em `src/lib/rotas.ts` (view, caminho no endereço,
título). A rota desenha a `<section id="page-<view>">`, marca a `.active` pela navegação, põe a tela
num `ErrorBoundary` e chama `render()` a cada abertura. A tela visitada continua montada. Quem
precisa de outra tela usa o registro (`carregarTela(view)`, `src/app/registro-das-telas.ts`), nunca
`window`. O título e a área ficam no cabeçalho (vêm da navegação); a tela não repete. A área vem de
`usarAreaAtual()`/`obterDadosDoMonitoramento()`, o tema de `usarTemaEscuro()` (`src/app/tema.ts`).

**Seção de Configurações** (modelos: `src/modulos/acessos/` e `src/modulos/modulos/`): é rota
(`/administracao/configuracoes/<seção>`). A de tela própria tem `criar<Nome>()` (`{ conteudo, nome,
render(), confirmarSaida() }`), registrada como `secao:<id>` em `src/app/telas.tsx`; a página de
Configurações a desenha no bloco dela (`#acessosApp`…) dentro do `<article>` da seção e chama
`render()` a cada abertura da seção (`aberturaDaSecao` da navegação). Sair com rascunho pergunta
(`confirmarSaida`, pelo registro). As seções que publicam pela barra fixa (Marca… Operação) entram
por portal no corpo da seção, pela moldura `src/modulos/configuracoes/configuracoes.tsx` (rota
`config`).

## Telas sob demanda (fora do pacote principal)

A Visão geral, Editais e a casca (menu, cabeçalho, sessão) ficam no pacote principal. As demais
telas de página inteira baixam na primeira abertura: `carregar: () => import("…")` em
`src/app/telas.tsx`, com `React.lazy` sobre `carregarTela` (que usa `importarComRecarga`: versão nova
publicada com a página aberta recarrega uma vez). Enquanto baixa, a seção mostra "Carregando…"; se
falhar, o aviso com "Tentar de novo" refaz o `lazy`. O item do menu pré-carrega no mouse/foco
(`src/lib/carga-de-telas.ts` → `preCarregarTelaRegistrada`) e o tour da Aya espera a carga
(`haTelaCarregando`). A moldura de Configurações e as seções Acessos, Módulos e abas, Status das
atualizações e Automação baixam do mesmo jeito (`config` e `secao:<id>` no registro). A base de
verbetes da Aya baixa ao abrir o painel.

## Como usar `ui/`

Importe do índice: `import { Kpi, GradeDeKpis, Aviso } from "../../ui/index.ts";`. O `ui.css` é
importado uma vez no ponto de entrada (`src/main.ts`); o CSS próprio de um módulo de
`src/modulos/` aberto sob demanda é importado pelo ponto de entrada da tela (baixa junto com o código,
num CSS à parte); só fica no `src/main.ts`, logo depois do `ui.css`, o CSS de módulo cujas classes
aparecem fora da própria tela.

Os componentes emitem só classes `.ui-*` (prefixo para não colidir com `.panel`,
`.kpi`, `.card`… de `app.css`) e nenhum id fixo. Peças de layout em CSS, sem componente:
`.ui-tela` (raiz da tela), `.ui-card`, `.ui-titulo`, `.ui-linha-de-cards` (dois cards lado a lado),
`.ui-pilha` (card com título e lista embaixo),
`.ui-grade-de-campos`, `.ui-acoes`, `.ui-barra-de-salvar` (barra presa ao pé com o resumo, o motivo e as
ações: Acessos, Módulos e abas), `.ui-gaveta-contexto`, `.ui-gaveta-corpo`, `.ui-gaveta-rodape`,
`.ui-texto-principal`/`.ui-texto-secundario` (célula), `.ui-secao-texto`/`.ui-secao-vazio`,
`.ui-esqueleto` (skeleton), `.btn.small`/`.btn.danger` dentro de `.ui-tela`/`.ui-gaveta` e `.btn.ghost`
(fantasma) / `.btn.perigo` (texto na cor de perigo) em qualquer lugar.

| Componente                            | API (uma linha)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TopoDoPainel`                        | `{ visoes?, status, aoAtualizar, idDaAtualizacao?, atualizarDesativado?, aoExportar?, exportarDesativado?, children? }` — sem título, tema nem tela cheia (são do app); filhos são botões extras                                                                                                                                                                                                                                                                                        |
| `PainelDeFiltros`                     | `{ idDoTitulo, className?, recolhivel = true, quantos, escopo = "Todos", podeLimpar?, aoLimpar, aoRecolher?(recolhido), children }` — "Refinar resultados" com resumo, recolher e Limpar tudo                                                                                                                                                                                                                                                                                           |
| `ChipsDeFiltro` / `ChipDeFiltro`      | `{ children }` / `{ rotulo, aoTirar, children }` — filtros aplicados                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Kpi`                                 | `{ cor?, tom?, icone?, rotulo, valor, chave, titulo?, ativo?, aoClicar?, carregando?, idDoValor?, detalhe? }` — card de 78px, tile do ícone no tom; com `aoClicar` vira botão (filtro com `ativo`, atalho sem); `carregando` = skeleton; `detalhe` é o complemento do número ("45%", "de 1.200")                                                                                                                                                                                        |
| `GradeDeKpis`                         | `{ id?, className?, rotulo, children }`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CardDeGrafico`                       | `{ titulo, altura? ("short", "alto"), carregando?, className?, elemento = "article", children }` — sem sobretítulo nem dica                                                                                                                                                                                                                                                                                                                                                             |
| `Grafico` / `paletaDosGraficos`       | `{ tipo, montar() → { data, options }, dependencias, rotulo, id?, plugins? }` — Chart.js criado uma vez e atualizado; `paletaDosGraficos(escuro, reserva)` lê as cores dos tokens                                                                                                                                                                                                                                                                                                       |
| `TabelaInfinita`                      | `{ idDoTitulo, titulo, busca?: { placeholder, rotulo, valor?, aoMudar?, id? }, carregado, itens, filtrarPelaBusca, colunas, classeDaTabela?, className?, idDoCorpo?, linha(item), informacao(quantos \| null), total, vazio, grupo?: { chave, cabecalho(chave, quantos), recolhidos?, aoAlternar? } }` — 50 por vez, mais 50 ao rolar ou no "Carregar mais"; busca controlável (sem `busca`, sem o campo); `grupo` põe um cabeçalho recolhível por grupo; avisa `agsus:content-updated` |
| `Gaveta`                              | `{ id, tituloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, sobretitulo?, titulo, resumo?, rotuloDoFechar, children }` — encostada à direita                                                                                                                                                                                                                                                                                                                          |
| `TopoDaGaveta`                        | `{ sobretitulo?, titulo, tituloId, resumo?, aoFechar, rotuloDoFechar }` — quando o topo fica dentro de um `<form>`; `usarClassesDaGaveta()` dá as classes do fundo e do cartão para um `<Modal>` direto                                                                                                                                                                                                                                                                                 |
| `Secao` / `Kv` / `GradeDeKv`          | `{ icone, titulo, secao, children }` / `{ rotulo, children }` (vazio vira "—") / `{ className?, rotulo?, children }` — o detalhe na gaveta                                                                                                                                                                                                                                                                                                                                              |
| `Modal`                               | `{ id, rotuloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, children }` — portal, Esc, foco preso                                                                                                                                                                                                                                                                                                                                                                     |
| `Aviso`                               | `{ tom? ("info" \| "warning" \| "danger"), papel?, como = "div", className?, children }`                                                                                                                                                                                                                                                                                                                                                                                                |
| `Campo`                               | `{ rotulo, erro?, dica?, obrigatorio?, largo?, idDoControle?, children }` — liga o rótulo ao 1º controle (ou ao `idDoControle`)                                                                                                                                                                                                                                                                                                                                                         |
| `Selo`                                | `{ tom = "neutro" ("aprovado", "reprovado", "pendente", "revisar"), titulo?, className?, children }`                                                                                                                                                                                                                                                                                                                                                                                    |
| `EstadoVazio` / `Carregando`          | `{ className?, children }` — `.ui-vazio`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ErroAoCarregar`                      | `{ oQue, mensagem?, aoTentar?, id?, idDoBotao?, className? }` — a primeira carga falhou: `Aviso` danger com "Tentar novamente"                                                                                                                                                                                                                                                                                                                                                          |
| `LinhasEsqueleto` / `BlocosEsqueleto` | `{ colunas, linhas = 8 }` (linhas `<tr>` de tabela; a `TabelaInfinita` usa) / `{ quantos = 3, className?, como? }` (blocos de lista, cartão ou dia) — skeleton antes da primeira carga                                                                                                                                                                                                                                                                                                  |
| `BotaoDeAcao`                         | `{ estado, acao, soIcone?, disabled?, ...atributos }` — botão de ação que escreve no banco: com `estado.acao = { tipo, rotulo }` em curso, mostra o rótulo e desativa os outros (Aprovados, Acessos, Módulos)                                                                                                                                                                                                                                                                           |
| `Segmentado`                          | `{ rotulo, opcoes: [{ valor, rotulo, icone? }], valor, aoMudar, desabilitado?, className? }` — radiogroup, setas ← → movem a escolha (visões de Entrevistas no topo, escala, comparecimento)                                                                                                                                                                                                                                                                                            |
| `Abas`                                | `{ rotulo, abas: [{ id, rotulo, icone?, contagem?, idDaAba?, idDoPainel?, dados? }], ativa, aoEscolher, compactas?, className? }` — tablist sublinhado, setas ← → movem a escolha; `compactas` dentro de modal (Acessos, modais da Lista de aprovados)                                                                                                                                                                                                                                  |
| `LinhaDoRecorte` / `MarcasDoRecorte`  | `{ ativos?: [[campo, rótulo, valor]], texto?, children? }` — "Recorte ativo: …" ou "Sem filtros" (`textoDoRecorte(ativos)`; `texto` troca a frase); filhos abaixo / `{ marcas: [{ chave, tom?, icone?, texto }] }` — as marcas (sucesso, alerta, neutro)                                                                                                                                                                                                                                |
| `ListaDePendencias`                   | `{ itens: [{ chave, titulo, detalhe, tom? ("alerta" \| "perigo"), ativo?, aoClicar }], carregando?, vazio }` — botões que filtram (`ativo` → `aria-pressed`) ou abrem uma lista; skeleton                                                                                                                                                                                                                                                                                               |
| `MaisOpcoes`                          | `{ id, aberto, aoAlternar, quantos?, titulo, children }` — botão "Mais opções" com a contagem e o bloco dos filtros adicionais (controlado)                                                                                                                                                                                                                                                                                                                                             |
| `Popover`                             | `{ rotulo, gatilho, dica?, classeDoBotao?, lado?, acao?, tour?, children (ou (fechar) => …) }` — botão discreto que abre um painel (Esc, clicar fora fecham); ex.: o "i", o "?" e o "⋯" da ficha da Avaliação documental                                                                                                                                                                                                                                                                |
| `MenuDeAcoes`                         | `{ rotulo, icone?, acoes: [{ id, rotulo, icone?, aoEscolher, desabilitado?, dados?, atalho? }], contagem?, tour?, compacto? }` — botão que abre a lista de ações (Esc, clicar fora ou escolher fecham; setas andam); ex.: "Ações da coordenação" na Fila; `compacto` é o "⋯" de uma linha (lista presa à janela)                                                                                                                                                                        |
| `AcoesDaLinha`                        | `{ pessoa, principal?: { rotulo, icone?, aoClicar, desabilitado?, ocupado?, acao? }, outras?: AcaoDoMenu[] }` — as ações de uma linha de tabela: o botão principal e o "⋯" (telas da seleção)                                                                                                                                                                                                                                                                                           |
| `BarraDeFiltros`                      | `{ rotulo, busca: { valor, aoMudar, placeholder, rotulo, aoTeclar?, acao? }, quantos, aoLimpar, resultado?, acoes?, children }` — "encontrar a pessoa": busca em destaque (tecla "/"), filtros em linha, resultado, quantos filtros e Limpar; sempre à vista                                                                                                                                                                                                                            |
| `BarraDaLista`                        | `{ rotulo, busca, quantos, aoLimpar, secundarios?, quantosSecundarios?, acoes?, children }` — a barra no alto do card da lista das telas da seleção: busca ("/"), filtros em linha, "Filtros" com os secundários, Limpar e as ações à direita                                                                                                                                                                                                                                           |
| `CabecalhoDaTela`                     | `{ trilha, titulo, edital?, secoes?, aoAtualizar?, children? }` — o cabeçalho das telas da seleção numa linha: trilha e título, edital, seções e Atualizar só com o ícone (a rota leva `tituloNaTela`)                                                                                                                                                                                                                                                                                  |
| `FaixaDeSituacao`                     | `{ rotulo, itens: ItemDaFaixa[], distribuicao?, totalDaDistribuicao?, rodape?, children }` — os números-filtro da lista num card só (`aria-pressed`), com a barra da distribuição (`role=img`) e a linha de baixo                                                                                                                                                                                                                                                                       |
| `CardDaLista` + `TabelaPaginada`      | `{ rotulo, colunas, itens, linha, carregado, vazio, grupo?, servidor?, chaveDoRecorte?, aoExportar? }` — a lista das telas da seleção: 50 por vez, "1–50 de N", Anterior / Próxima, Exportar CSV, "Ninguém por aqui"; rola de lado no celular                                                                                                                                                                                                                                           |
| `usarEstadoDaSessao`                  | `(chave, inicial, normalizar)` — estado da tela guardado na sessão da aba (os filtros voltam no F5); `lerDaSessao`/`gravarNaSessao` sem React                                                                                                                                                                                                                                                                                                                                           |     |
| `classes(...)`                        | junta classes ignorando as vazias                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Componente entra em `ui/` quando **duas telas ou mais** repetem a mesma peça; o que é de uma tela
só fica no módulo.

O modo "no quadro" (`<PainelNoQuadro>`, a marcação do antigo painel de análises para as telas que
rodavam em iframe) saiu com a Seleção, a última delas, ao fim da Etapa 2 — junto com o CSS que
sobrava em `src/analises/` e o `pagina-do-painel.js` de `src/modules/` (o que restou dele é o
`src/lib/pagina-do-painel.ts`). Nenhuma tela do app abre mais em
iframe; só os painéis externos (`TB_PAINEL_EXTERNO`) continuam no quadro.

## Etapa 6 — login e entrada

### Fase 1 (feita): a sessão e a tela de acesso em React

```
src/app/sessao.ts                     estado da sessão (sem React): sessaoDoApp
src/app/entrada/entrada.tsx           <TelaDeEntrada> (portal da raiz única) e ligarEntradaAPagina()
src/app/entrada/marca.ts              marca da tela de acesso (cache → RPC pública → configuração)
src/app/entrada/pedido-de-acesso.ts        estado do pedido de acesso (RPCs; editar, cancelar)
src/app/entrada/solicitacao-de-acesso.tsx  página "Solicitação de acesso" (abas por área, Aya) / "Acesso desativado"
```

`src/main.ts` importa `marca.ts` primeiro (pinta a marca guardada antes da rede), monta a entrada
logo no início (a raiz única, `montarRaiz()`, troca o cartão vazio do `#telaDeEntrada` pelo de verdade) e, no
fim, chama `sessaoDoApp.iniciar()`. O `index.html` mantém o `#loginScreen` e os scripts do `<head>`
(marca antes do primeiro quadro, `sessao-guardada`, `vite-dev-carregando`). Ids e classes da tela
são os de antes (`#googleLoginBtn`, `#loginMsg`, `#accessRequestCard`…): o CSS da tela de acesso e
os testes de ponta a ponta continuam valendo; o formulário do pedido usa `Campo` de `src/ui/`.
Testes: `tests/app/sessao.test.js`, `tests/app/entrada.test.js`, `tests/solicitacao-de-acesso.test.js`,
`tests/solicitacao-de-acesso-migration.test.js`.

| Antes (legado)                                                                       | Agora                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `boot()`, `onAuthStateChange`, `?code=`, `?auth=google`, recuperação de senha        | `sessaoDoApp.iniciar()`, `aoMudarAutenticacao`, `trocarCodigoDoOAuth`           |
| `handleSignedInSession` (domínio, mesmo usuário, carga única)                        | `entrar()`                                                                      |
| `loadProfile` (`obter_contexto_monitora`, `meu_usuario`)                             | `carregarPerfil()` na sessão                                                    |
| `loginWithGoogle`, popup, `message`, `pageshow`, `mobile-google-oauth.js`            | `entrarComGoogle()`; `startMobileGoogleOAuth` em `src/lib/auth-flow.ts`         |
| `logout`, `returnToLogin`, `clearLocalAuthState`, `aplicarSaida`                     | `sair()`, `limparSessao()`, `aplicarSaida()` na sessão                          |
| `showAccessRequestState`, `submitAccessRequest`, `solicitacao-de-acesso.js` (legado) | `pedido-de-acesso.ts` + `solicitacao-de-acesso.tsx`                             |
| `access-branding-boot.js`, marca e rodapé de `applyConfigToUi`                       | `src/app/entrada/marca.ts` (`definirMarcaDaConfiguracao`)                       |
| marcas de conta desativada e de boas-vindas (`comemoracao-do-acesso.ts`)             | `src/lib/acesso-liberado.ts` (a comemoração continua no legado)                 |
| `#loginMsg` escrito por `session-lifecycle.js`                                       | `installSessionLifecycle({ aoExpirar })` → `sessaoDoApp.mostrarMensagem`        |
| `window.loginWithGoogle`, `logout`, `returnToLogin`, `submitAccessRequest`           | saíram; o Sair confirmado (`src/app/casca/saida.ts`) chama `sessaoDoApp.sair()` |

Acesso só por convite: a sessão não chama mais `garantir_acesso_basico` (saiu do front e do
contrato de RPC); quem não tem perfil ativo vê o pedido de acesso.

### Sessão ↔ sistema (o contrato)

`sessaoDoApp.obter()` devolve `{ fase, usuario, perfil, painelIds, contextoCarregado, mensagem,
entrando, erroDeConfiguracao, consultarPedido, configuracao }`, com `fase` em `FASES`:
`iniciando` → `deslogado` | `abrindo` → `conectado` | `sem-acesso` | `falha-na-entrada` (perfil
ilegível ou abertura quebrada: a entrada mostra o erro e "Tentar de novo", nunca o pedido de acesso).

O sistema depois de entrar é `src/app/sistema.ts` (fase 2, abaixo): `ligarSistema()`, chamado no
começo de `src/main.ts`, cria as peças, publica os contratos em `window` e registra os ganchos de
`sessaoDoApp.ligarSistema({...})`. `src/app/perfil.ts` copia usuário e perfil da sessão; a
configuração (`src/app/configuracao.ts`) chama `sessaoDoApp.definirConfiguracao` e
`definirMarcaDaConfiguracao`.

| Gancho                 | Quando                                        | O sistema faz                                                       |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `carregarConfiguracao` | no arranque, antes de olhar a sessão          | `configuracao.carregar({ silent: true })`                           |
| `mostrarEsqueleto`     | retorno do Google com `?code=`                | skeleton no formato da última tela                                  |
| `aoVerificar`          | sessão válida, antes de consultar o perfil    | skeleton + começa a ler a cópia da sessão (`carga.prepararEntrada`) |
| `abrir`                | perfil confirmado; `true` = sistema aberto    | `carga.carregarEntrada`, auditoria, heartbeat, presença, Realtime   |
| `aoFicarSemAcesso`     | sem perfil ativo                              | apaga a cópia, para Realtime e heartbeat, esconde `#appScreen`      |
| `aoFalharNaEntrada`    | perfil ilegível ou abertura quebrada          | o mesmo, sem apagar a cópia da sessão                               |
| `aoAtualizarPerfil`    | `USER_UPDATED` com o sistema aberto           | painéis liberados, menu, volta à tela de entrada se preciso         |
| `antesDeSair`          | botão Sair, antes do `signOut()`              | auditoria `logout`, para o Realtime, apaga o cache de análises      |
| `aoSair`               | estado deslogado aplicado (uma vez por saída) | limpa linhas, presença, painéis externos, esconde `#appScreen`      |
| `aoLimparSessao`       | "Voltar ao login" do pedido                   | apaga a cópia da sessão                                             |
| `encerrarEspera`       | fim de toda entrada (deu certo ou não)        | esconde o skeleton e tira `body.config-loading`                     |

`#loginScreen` e `body.access-request-mode` são da entrada (`ligarEntradaAPagina`, pela fase);
`#appScreen` é de `perfil.mostrarApp()`/`esconderApp()`.

### Fase 2 (feita): o fim do `legacy-app.js`

O `legacy-app.js` de `src/modules/` (1.946 linhas) saiu. Cada responsabilidade virou um módulo pequeno de
`src/app/`, criado por fábrica (`criarX({ dependências })`, testável com dependências falsas em
`tests/app/`) e ligado em `src/app/sistema.ts`:

```
src/app/sistema.ts               cria as peças, contratos em window, ganchos da sessão, busca global
src/app/navegacao.ts             troca de tela (.active, título, menu marcado), permissões, guarda de
                                 saída, versão nova esperando, tela guardada, menu (TELAS_REACT)
src/lib/navegacao.ts             regras puras: bloqueioDaTela, telaPermitida, telaInicialDoSistema…
src/app/configuracao.ts          TB_CONFIGURACAO, textos do app, aviso global, fundo do acesso
src/app/paineis-externos.ts      painéis externos: lista, liberados, quadro (iframe na 1ª abertura)
src/app/carga.ts                 consultas em paralelo, cópia da sessão, "Atualizar dados", Realtime
src/app/presenca.ts              auditoria, heartbeat, presença e a lista de Pessoas online
src/componentes/pessoas-online/  o botão e a lista no cabeçalho (React)
src/app/perfil.ts                usuário e perfil (cópia da sessão), cabeçalho, #appScreen
src/app/moldura.ts               barra recolhida, tema, tela cheia, relatório em PDF
src/app/avisos.ts                toast (window.monitoraToast) e loader (window.monitoraLoader)
src/app/carregamento.ts          skeleton da entrada e do painel externo, barra do "Atualizar dados"
src/lib/erro-amigavel.ts         a frase do erro (antigo friendlyError)
```

Contratos mantidos em `window`: `navigate` (é `navegacao.irPara`; agora também escreve o endereço), `refreshData`,
`getMonitoraProfile`, `monitoraToast`, `monitoraLoader`, `exitExternalPanel`,
`reloadExternal`, `exportPDF`, `toggleBrowserFullscreen`, `toggleDarkMode`, `toggleSidebar`
(saíram `window.$`, `toggleOnlinePresence` e `getMonitoraUser`, sem uso). As telas não estão mais em
`window`: são rotas (`src/app/telas.tsx`), e a rota chama `render()` a cada abertura.
Quem acompanha a navegação assina `navegacao.assinar`: `{ tipo: "abertura", view, anterior }`
(auditoria) e `{ tipo: "menu" }` (o lugar da pessoa na presença).

Testes: `tests/app/navegacao.test.js`, `carga.test.js`, `configuracao.test.js`,
`paineis-externos.test.js`, `presenca.test.js`, `perfil.test.js`, `moldura.test.js`,
`sistema.test.js`, `tests/navegacao.test.js` e `tests/componentes/pessoas-online.test.js`. Os testes
que conferem que algo antigo não voltou leem `src/app/` inteiro (`tests/fonte-do-app.js`).

Ficou para depois (ainda em `src/modules/` ou no `index.html`):

1. **Layout em React**: a casca saiu do `index.html` (ver "Casca em React", abaixo); falta o
   resto das partes. As telas continuam `<section class="page">` com `.active`.
   `src/componentes/barra-lateral/`, `dados-do-monitoramento.ts` e `usar-area-atual.ts` mudam
   para `src/app/` quando a barra virar filha da casca.
2. **Rotas**: feitas (`docs/arquitetura/raiz-react.md`): a área e a tela no endereço; a tela
   guardada no localStorage só vale quando a página abre na raiz (`/`).
3. `pwa-lifecycle.ts` (a situação dos módulos já foi: `src/app/situacao-do-sistema.ts`),
   `catalogo-de-abas.ts`, `copia-da-sessao-indexeddb.ts`, `cache-de-payload-indexeddb.ts`,
   `comemoracao-do-acesso.ts` → `src/app/` ou React.
4. O CSS da tela de acesso espalhado (`app.css`, `platform-shell.css`,
   `post-152-regression-fixes.css`, `visual-polish.css`, `mobile-app.css`) consolidado num
   CSS da entrada em `src/app/entrada/` (hoje só o `solicitacao-de-acesso.css`); `auth-storage.ts` → `src/lib/`.

### Casca em React (em partes)

A marcação fixa do `index.html` vira React em PRs pequenos, com o mesmo DOM (ids, classes, ordem)
e a mesma ordem de arranque. Conferência de cada parte: prints antes/depois (desktop e 375px,
claro e escuro) e o DOM do `#appScreen` com posição e tamanho de cada elemento.

| Parte | O quê                                                                                                                                                                                   | Situação |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A     | `#appScreen`: volta do painel externo, `<aside>` da barra, cabeçalho e menu da conta, pontos de montagem do topo, aviso global, seções das telas, quadro externo, Configurações         | feita    |
| B     | Celular: sem menu no pé da tela; a gaveta (☰) e as tabelas em cartão viram `src/app/casca/` (`mobile-*.js` saíram)                                                                     | feita    |
| C     | Carregamento e avisos: `#loader`, `#toastBox`, `#offlineBar`, `loading-experience.js`, `connectivity-status.js`, `notificacao.js`; o skeleton da entrada fica no HTML (primeiro quadro) | feita    |
| D     | `nielsen-shell-ux.js` (diálogo de saída), `sidebar-branding.js`, `visual-polish.js`, `map-base-layer-switcher.js` (`indigenous-territories-layer.js` só vira TS)                        | feita    |

**Parte A** — `src/app/casca/`:

```
casca.tsx            <Casca> (memo, sem props): barra lateral, cabeçalho e <Telas>; portal da raiz em #appScreen
topo.tsx             header.top: título (da navegação), Pessoas online, menu da conta (o ☰ é da barra lateral)
../telas.tsx         .content: as <section class="page"> (TELAS_DA_CASCA, rotas), quadro externo, Configurações
acoes.ts             os botões chamam window.refreshData, exportPDF… na hora do clique (como os onclick)
```

`src/main.ts` chama `montarRaiz()` (a raiz única, com a casca) antes de `ligarSistema()`: tudo que
procura um id da casca (sistema, ilhas, legado) já o encontra. O `#appScreen` continua no
`index.html` (classe `hidden` desde o primeiro quadro). A casca não tem props; quem se redesenha são
as filhas que leem estado: a barra lateral, o título do cabeçalho e as telas (a `.active` vem da
navegação). Perfil, textos configuráveis e a faixa de manutenção ainda são escritos de fora, e as
ilhas que sobram (Pessoas online, Aya, aviso de versão, encerramento, selos) são raízes próprias
nos elementos vazios dela (passo 2 de `docs/arquitetura/raiz-react.md`). Testes que leem a marcação do app usam
`tests/pagina-montada.js` (`htmlDaPagina()`: o `index.html` com a casca desenhada).

**Parte B** — o celular (até 900px), em `src/app/casca/`:

```
gaveta-do-celular.tsx  <GavetaDoCelular>: o véu #sidebarOverlay e a gaveta (fecha ao escolher página,
                       ao tocar fora e com Esc; inert na gaveta fechada ou no conteúdo com ela aberta;
                       foco na página atual ao abrir e de volta no ☰ ao fechar)
tabelas-em-cartoes.ts  usarTabelasEmCartoes(): cada linha de tabela vira cartão (data-mobile-label)
```

Não há menu no pé da tela: a navegação é uma só, o ☰ do topo (`#globalSidebarToggle`, da barra
lateral) abre a mesma barra lateral como gaveta. O topo é uma linha só e o conteúdo usa a altura
toda (nenhuma barra soma recuo de menu inferior). O registro do service worker foi para
`pwa-lifecycle.ts`. Testes: `tests/app/gaveta-do-celular.test.js` e `tests/layout-no-celular.test.js`.

**Parte C** — carregamento e avisos, em `src/app/casca/`, por portal da raiz única (`#avisosApp`, no começo
do `<body>`), fora do `#appScreen` porque a tela de acesso também usa:

```
avisos.tsx               <Avisos>: portal da raiz única (src/app/raiz.tsx) em #avisosApp
notificacoes.tsx         #toastBox e os cartões .toast (somem em 4,5s; parados sob o mouse, esperam)
tela-de-carregamento.tsx #loader: etapa no lugar do texto genérico, "Etapa X de Y", demora e
                         "Tentar novamente" (getLoadingStage); o relógio só corre com ele à vista
aviso-de-conexao.tsx     #connectivityStatusNotice: "Sem conexão" e "Conexão restabelecida" (3,2s)
```

O estado fica em `src/app/avisos.ts` (sem React): `avisar(texto, tom)` e
`mostrarCarregamento(mostrar, titulo, subtitulo, percentual)` continuam sendo
`window.monitoraToast`/`window.monitoraLoader`, e quem chama antes da montagem não perde o aviso.
O `#offlineBar` (sempre escondido; só recebia o texto `offline_message`) saiu: o aviso de
conexão é o `#connectivityStatusNotice`. Ids e classes são os de antes (CSS em `app.css`,
`loading-experience.css` e `connectivity-status.css`). Testes: `tests/app/avisos.test.js`.

**Parte D** — o último JavaScript escrito à mão de `src/modules/` (03/11/2026):

```
src/componentes/barra-lateral/marca.ts    a logo e a cor gravadas (era sidebar-branding.js): a cor
                                          vai para --sidebar-custom-bg e body.sidebar-theme-dark;
                                          o <img id="sideLogo"> é do React e lê a logo daqui
src/componentes/barra-lateral/seletor-de-tema.ts  opções e regra do Claro/Escuro do rodapé
src/app/casca/saida.ts                    o Sair confirmado (sairDoSistema), sem React
src/app/casca/confirmacao-de-saida.tsx    "Deseja realmente sair?" e "Saindo do sistema…", nos
                                          avisos (era HTML injetado por nielsen-shell-ux.js)
src/styles/visual-polish.css              as regras valem em :root (a classe visual-polish-ready,
                                          que o visual-polish.js punha sempre, saiu)
src/modules/map-base-layer-switcher.ts    Mapa/Satélite, em TypeScript; continua L.control (o
                                          canto de controles é do Leaflet, nos três mapas)
src/modules/indigenous-territories-layer.ts  Terras Indígenas em TypeScript; as partes puras
                                          (catálogo, textos, geometria, fases e estilos,
                                          preferências) em src/lib/terras-indigenas/
```

`scripts/check-legado-so-encolhe.mjs` agora também recusa qualquer `.js` nas pastas do legado
(só o gerado da Aya fica). Testes: `tests/componentes/confirmacao-de-saida.test.js` e
`tests/componentes/barra-lateral.test.js` (marca).
