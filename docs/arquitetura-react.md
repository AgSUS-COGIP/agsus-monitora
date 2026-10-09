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
3. **Isolamento.** Cada módulo monta dentro de um `ErrorBoundary` (via `montarModulo`): erro numa
   tela mostra um aviso curto com "Tentar de novo" e não derruba o resto.
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
| `src/app/` (`montar-modulo.jsx`, `ErrorBoundary.jsx`)                                                            | fica                                                      | —          |
| `src/ui/` (design system)                                                                                        | fica                                                      | —          |
| `src/componentes/icone.jsx`, `multi-select-busca.jsx`                                                            | `src/ui/`                                                 | ao tocar   |
| Configurações (moldura, seções e `secoes.js`), Acessos, Módulos e abas                                           | `src/modulos/configuracoes/`, `acessos/`, `modulos/`      | concluído  |
| `src/componentes/saude-das-cargas/` (Status das atualizações)                                                    | `src/modulos/`                                            | ao tocar   |
| Editais, Cronograma e Lista de aprovados                                                                         | `src/modulos/editais/`, `cronograma/`, `aprovados/`       | concluído  |
| `src/modules/map-*`, `health-*`, `indigenous-*`, (o dashboard já saiu do legado)                                 | `src/modulos/visao-geral/`                                | 5          |
| `src/main.js`, `index.html`, `src/componentes/barra-lateral/`, `dados-do-monitoramento.ts`, `usar-area-atual.ts` | `src/app/` (entrada, layout, área atual)                  | 6          |
| `auth-storage.js`, `sidebar-branding.js` (o login e o `legacy-app.js` já estão em `src/app/`)                    | `src/lib/` e barra lateral                                | 6          |
| `src/modules/aya-*` (IA, base e memória; o painel já é `src/modulos/aya/`)                                       | `src/app/` (Aya no layout)                                | 7          |
| `src/lib/`                                                                                                       | fica                                                      | —          |
| `src/styles/tokens.css`                                                                                          | fica; os outros CSS vão com o módulo ou saem com o legado | cada etapa |

`src/modules/` **é** o legado de hoje (`src/analises/` ficou só com o `CLAUDE.md`: o painel de
Análises e o CSS do quadro saíram). `src/legado/` fica vazio por enquanto:
só recebe código antigo numa mudança em bloco combinada antes (ver `src/legado/README.md`).

## Como criar um módulo novo

```
src/modulos/<nome>/
  <nome>.jsx      componente da tela + montar<Nome>(), que chama montarModulo
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

```jsx
import { montarModulo } from "../../app/montar-modulo.jsx";

export function montarTela({
  elemento = document.getElementById("telaApp"),
  supabase,
} = {}) {
  const estado = criarEstadoDaTela({ supabase });
  const { raiz, desmontar } = montarModulo(elemento, <Tela estado={estado} />, {
    nome: "a tela X", // aparece no console se o módulo quebrar
    flushSync: false, // true quando o código seguinte precisa do DOM do módulo já desenhado
  });
  return { estado, raiz, desmontar, render: () => estado.carregar() };
}
```

`montarModulo(elemento, <Componente/>, { flushSync, nome })` = `createRoot` + `StrictMode` +
`ErrorBoundary`; devolve `{ raiz, desmontar }`. Todas as ilhas React de hoje (as de `src/main.js`)
montam por ele. Usa `flushSync` a barra lateral (o legado lê `#nav` logo depois).

**Seção de Configurações** (modelos: `src/modulos/acessos/` e `src/modulos/modulos/`): monta no bloco do `index.html` (`#acessosApp`, `#modulosApp`) que `src/modulos/configuracoes/secoes.js` move para a seção; o controlador em `window` (`acessosController`) tem `render()` e `confirmarSaida()` (a guarda de saída). As seções que publicam pela barra fixa (Marca… Operação) entram por portal no corpo da seção, pela moldura `src/modulos/configuracoes/configuracoes.jsx`.

**Tela de página inteira** (modelos: `src/modulos/recursos/`, `src/modulos/selecao/`, `src/modulos/entrevistas/`, esta com visões num `Segmentado` no topo, e `src/modulos/analises/`): monta na `<section id="page-<view>">`
vazia do `index.html`, sem pedir nada ao banco; `src/main.js` guarda o controlador em `window`
(`recursosController`) e a navegação (`src/app/navegacao.js`) chama `render()` ao abrir (tabela `TELAS_REACT`).
A área vem de `usarAreaAtual()`/`obterDadosDoMonitoramento()`, o tema de `usarTemaEscuro()`
(`src/app/tema.js`), o aviso de `window.monitoraToast` (passado na montagem). O título e a área
ficam no cabeçalho do app (`navegacao.definirTitulo`); a tela não repete.

## Telas sob demanda (fora do pacote principal)

A Visão geral e o casco (menu, cabeçalho, sessão, Aya) ficam no pacote principal. As demais telas
de página inteira (Avaliação documental, Classificação, Entrevistas, Recursos, Lista de aprovados,
Cronograma, Análises, Seleção) e as seções Acessos, Módulos e abas e Status das atualizações
baixam na primeira abertura: em `src/main.js`, `window.<tela>Controller = telaSobDemanda({ secao,
metodos, padroes, carregar: () => import("…").then((m) => m.montarX(…)) })`
(`src/app/tela-sob-demanda.js`). O controlador mantém o contrato (`render()`, `abrirVisao()`…;
`estado` só depois da carga, `carregar()` para esperar), a seção mostra "Carregando…" enquanto
baixa, o item do menu pré-carrega no mouse/foco (`src/lib/carga-de-telas.js`) e o tour da Aya
espera a carga. A base de verbetes da Aya baixa ao abrir o painel. Tela nova de página inteira
entra assim, não com import estático em `main.js`.

## Como usar `ui/`

Importe do índice: `import { Kpi, GradeDeKpis, Aviso } from "../../ui/index.js";`. O `ui.css` é
importado uma vez no ponto de entrada (`src/main.js`); o CSS próprio de um módulo de
`src/modulos/` entra no `src/main.js` logo depois.

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
| `Kpi`                                 | `{ cor?, tom?, icone?, rotulo, valor, chave, titulo?, ativo?, aoClicar?, carregando?, idDoValor? }` — card de 78px, tile do ícone no tom; com `aoClicar` vira botão (filtro com `ativo`, atalho sem); `carregando` = skeleton                                                                                                                                                                                                                                                           |
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
| `MenuDeAcoes`                         | `{ rotulo, icone?, acoes: [{ id, rotulo, icone?, aoEscolher, desabilitado?, dados? }], contagem?, tour? }` — botão que abre a lista de ações (Esc, clicar fora ou escolher fecham; setas andam); ex.: "Ações da coordenação" na Fila                                                                                                                                                                                                                                                    |
| `classes(...)`                        | junta classes ignorando as vazias                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Componente entra em `ui/` quando **duas telas ou mais** repetem a mesma peça; o que é de uma tela
só fica no módulo.

O modo "no quadro" (`<PainelNoQuadro>`, a marcação do antigo painel de análises para as telas que
rodavam em iframe) saiu com a Seleção, a última delas, ao fim da Etapa 2 — junto com o CSS que
sobrava em `src/analises/` e `src/modules/pagina-do-painel.js`. Nenhuma tela do app abre mais em
iframe; só os painéis externos (`TB_PAINEL_EXTERNO`) continuam no quadro.

## Etapa 6 — login e entrada

### Fase 1 (feita): a sessão e a tela de acesso em React

```
src/app/sessao.js                     estado da sessão (sem React): sessaoDoApp
src/app/entrada/entrada.jsx           <TelaDeEntrada>, montarEntrada(), ligarEntradaAPagina()
src/app/entrada/marca.js              marca da tela de acesso (cache → RPC pública → configuração)
src/app/entrada/pedido-de-acesso.js   estado do pedido de acesso (RPCs)
src/app/entrada/pedido-de-acesso.jsx  cartão "Solicitar acesso" / "Acesso desativado"
```

`src/main.js` importa `marca.js` primeiro (pinta a marca guardada antes da rede), monta a entrada
logo no início (`montarEntrada()` troca o cartão vazio do `#telaDeEntrada` pelo de verdade) e, no
fim, chama `sessaoDoApp.iniciar()`. O `index.html` mantém o `#loginScreen` e os scripts do `<head>`
(marca antes do primeiro quadro, `sessao-guardada`, `vite-dev-carregando`). Ids e classes da tela
são os de antes (`#googleLoginBtn`, `#loginMsg`, `#accessRequestCard`…): o CSS da tela de acesso e
os testes de ponta a ponta continuam valendo; o formulário do pedido usa `Campo` de `src/ui/`.
Testes: `tests/app/sessao.test.js`, `tests/app/entrada.test.js`, `tests/solicitacao-de-acesso.test.js`.

| Antes (legado)                                                                          | Agora                                                                        |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `boot()`, `onAuthStateChange`, `?code=`, `?auth=google`, recuperação de senha           | `sessaoDoApp.iniciar()`, `aoMudarAutenticacao`, `trocarCodigoDoOAuth`        |
| `handleSignedInSession` (domínio, mesmo usuário, carga única)                           | `entrar()`                                                                   |
| `loadProfile` (`obter_contexto_monitora`, `meu_usuario`)                                | `carregarPerfil()` na sessão                                                 |
| `loginWithGoogle`, popup, `message`, `pageshow`, `mobile-google-oauth.js`               | `entrarComGoogle()`; `startMobileGoogleOAuth` em `src/lib/auth-flow.js`      |
| `logout`, `returnToLogin`, `clearLocalAuthState`, `aplicarSaida`                        | `sair()`, `limparSessao()`, `aplicarSaida()` na sessão                       |
| `showAccessRequestState`, `submitAccessRequest`, `src/modules/solicitacao-de-acesso.js` | `pedido-de-acesso.js` + `.jsx`                                               |
| `access-branding-boot.js`, marca e rodapé de `applyConfigToUi`                          | `src/app/entrada/marca.js` (`definirMarcaDaConfiguracao`)                    |
| marcas de conta desativada e de boas-vindas (`comemoracao-do-acesso.js`)                | `src/lib/acesso-liberado.js` (a comemoração continua no legado)              |
| `#loginMsg` escrito por `session-lifecycle.js`                                          | `installSessionLifecycle({ aoExpirar })` → `sessaoDoApp.mostrarMensagem`     |
| `window.loginWithGoogle`, `logout`, `returnToLogin`, `submitAccessRequest`              | saíram; o Sair confirmado (`nielsen-shell-ux.js`) chama `sessaoDoApp.sair()` |

Acesso só por convite: a sessão não chama mais `garantir_acesso_basico` (saiu do front e do
contrato de RPC); quem não tem perfil ativo vê o pedido de acesso.

### Sessão ↔ sistema (o contrato)

`sessaoDoApp.obter()` devolve `{ fase, usuario, perfil, painelIds, contextoCarregado, mensagem,
entrando, erroDeConfiguracao, consultarPedido, configuracao }`, com `fase` em `FASES`:
`iniciando` → `deslogado` | `abrindo` → `conectado` | `sem-acesso`.

O sistema depois de entrar é `src/app/sistema.js` (fase 2, abaixo): `ligarSistema()`, chamado no
começo de `src/main.js`, cria as peças, publica os contratos em `window` e registra os ganchos de
`sessaoDoApp.ligarSistema({...})`. `src/app/perfil.js` copia usuário e perfil da sessão; a
configuração (`src/app/configuracao.js`) chama `sessaoDoApp.definirConfiguracao` e
`definirMarcaDaConfiguracao`.

| Gancho                 | Quando                                        | O sistema faz                                                       |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `carregarConfiguracao` | no arranque, antes de olhar a sessão          | `configuracao.carregar({ silent: true })`                           |
| `mostrarEsqueleto`     | retorno do Google com `?code=`                | skeleton no formato da última tela                                  |
| `aoVerificar`          | sessão válida, antes de consultar o perfil    | skeleton + começa a ler a cópia da sessão (`carga.prepararEntrada`) |
| `abrir`                | perfil confirmado; `true` = sistema aberto    | `carga.carregarEntrada`, auditoria, heartbeat, presença, Realtime   |
| `aoFicarSemAcesso`     | sem perfil ativo                              | apaga a cópia, para Realtime e heartbeat, esconde `#appScreen`      |
| `aoAtualizarPerfil`    | `USER_UPDATED` com o sistema aberto           | painéis liberados, menu, volta à tela de entrada se preciso         |
| `antesDeSair`          | botão Sair, antes do `signOut()`              | auditoria `logout`, para o Realtime, apaga o cache de análises      |
| `aoSair`               | estado deslogado aplicado (uma vez por saída) | limpa linhas, presença, painéis externos, esconde `#appScreen`      |
| `aoLimparSessao`       | "Voltar ao login" do pedido                   | apaga a cópia da sessão                                             |
| `encerrarEspera`       | fim de toda entrada (deu certo ou não)        | esconde o skeleton e tira `body.config-loading`                     |

`#loginScreen` e `body.access-request-mode` são da entrada (`ligarEntradaAPagina`, pela fase);
`#appScreen` é de `perfil.mostrarApp()`/`esconderApp()`.

### Fase 2 (feita): o fim do `legacy-app.js`

`src/modules/legacy-app.js` (1.946 linhas) saiu. Cada responsabilidade virou um módulo pequeno de
`src/app/`, criado por fábrica (`criarX({ dependências })`, testável com dependências falsas em
`tests/app/`) e ligado em `src/app/sistema.js`:

```
src/app/sistema.js               cria as peças, contratos em window, ganchos da sessão, busca global
src/app/navegacao.js             troca de tela (.active, título, menu marcado), permissões, guarda de
                                 saída, versão nova esperando, tela guardada, menu (TELAS_REACT)
src/lib/navegacao.js             regras puras: bloqueioDaTela, telaPermitida, telaInicialDoSistema…
src/app/configuracao.js          TB_CONFIGURACAO, textos do app, aviso global, fundo do acesso
src/app/paineis-externos.js      painéis externos: lista, liberados, quadro (iframe na 1ª abertura)
src/app/carga.js                 consultas em paralelo, cópia da sessão, "Atualizar dados", Realtime
src/app/presenca.js              auditoria, heartbeat, presença e a lista de Pessoas online
src/componentes/pessoas-online/  o botão e a lista no cabeçalho (React)
src/app/perfil.js                usuário e perfil (cópia da sessão), cabeçalho, #appScreen
src/app/moldura.js               barra recolhida, tema, tela cheia, relatório em PDF
src/app/avisos.js                toast (window.monitoraToast) e loader (window.monitoraLoader)
src/app/carregamento.js          skeleton da entrada e do painel externo, barra do "Atualizar dados"
src/lib/erro-amigavel.js         a frase do erro (antigo friendlyError)
```

Contratos mantidos em `window`: `navigate` (é `navegacao.irPara`), `refreshData`,
`getMonitoraProfile`, `getMonitoraUser`, `monitoraToast`, `monitoraLoader`, `exitExternalPanel`,
`reloadExternal`, `exportPDF`, `toggleBrowserFullscreen`, `toggleDarkMode`, `toggleSidebar`
(saíram `window.$` e `toggleOnlinePresence`, sem uso). Os controladores das telas
(`window.recursosController`…) continuam sendo chamados pela navegação (`render()` ao abrir).
Quem acompanha a navegação assina `navegacao.assinar`: `{ tipo: "abertura", view, anterior }`
(auditoria) e `{ tipo: "menu" }` (o lugar da pessoa na presença).

Testes: `tests/app/navegacao.test.js`, `carga.test.js`, `configuracao.test.js`,
`paineis-externos.test.js`, `presenca.test.js`, `perfil.test.js`, `moldura.test.js`,
`sistema.test.js`, `tests/navegacao.test.js` e `tests/componentes/pessoas-online.test.js`. Os testes
que conferem que algo antigo não voltou leem `src/app/` inteiro (`tests/fonte-do-app.js`).

Ficou para depois (ainda em `src/modules/` ou no `index.html`):

1. **Layout em React**: `#appScreen` (cabeçalho, barra lateral, conteúdo) ainda é marcação do
   `index.html` com `onclick` (`refreshData`, `exportPDF`, `toggleSidebar`…); as telas ainda são
   `<section class="page">` com `.active`. `src/componentes/barra-lateral/`,
   `dados-do-monitoramento.ts` e `usar-area-atual.ts` mudam para `src/app/` junto.
2. **Rotas**: sem endereço por tela (hash/history); a tela guardada continua no localStorage.
3. `nielsen-shell-ux.js` (diálogo de saída por `insertAdjacentHTML` e os estados do seletor de
   tema), `mobile-bottom-navigation.js`, `mobile-app-experience.js`, `visual-polish.js`,
   `loading-experience.js`, `connectivity-status.js`, `pwa-lifecycle.js`, `situacao-dos-modulos.js`,
   `catalogo-de-abas.js`, `copia-da-sessao-indexeddb.js`, `cache-de-payload-indexeddb.js`,
   `comemoracao-do-acesso.js`, `notificacao.js` → `src/app/` ou React.
4. O CSS da tela de acesso espalhado (`app.css`, `platform-shell.css`,
   `post-152-regression-fixes.css`, `visual-polish.css`, `mobile-app.css`) consolidado em
   `src/app/entrada/entrada.css`; `auth-storage.js` → `src/lib/`, `sidebar-branding.js` → barra
   lateral.
