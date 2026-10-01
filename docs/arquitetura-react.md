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
| 3     | Configurações: todas as seções já são React; falta mudar para `src/modulos/`         |
| 4     | Análises (**feita**: `src/modulos/analises/`)                                        |
| 5     | Visão geral: primeiro o que não é mapa, depois os mapas                              |
| 6     | Login e entrada (**fase 1 feita**, ver abaixo); fim do `legacy-app.js` (fase 2)      |
| 7     | Aya                                                                                  |

A mudança de pasta acontece **módulo a módulo**, na etapa de cada um — mover tudo de uma vez
gera conflito com quem está trabalhando em paralelo.

## Onde está cada coisa hoje → para onde vai

| Hoje                                                                                                             | Alvo                                                      | Quando     |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| `src/app/` (`montar-modulo.jsx`, `ErrorBoundary.jsx`)                                                            | fica                                                      | —          |
| `src/ui/` (design system)                                                                                        | fica                                                      | —          |
| `src/componentes/modal.jsx` (só reexporta `src/ui/modal.jsx`)                                                    | sai quando ninguém importar daqui                         | ao tocar   |
| `src/componentes/icone.jsx`, `multi-select-busca.jsx`                                                            | `src/ui/`                                                 | ao tocar   |
| `src/componentes/configuracoes/`, `acessos/`, `modulos/`, `saude-das-cargas/` + `src/modules/config-secoes.js`   | `src/modulos/configuracoes/`                              | 3          |
| `src/componentes/nucleo/`, `calendario-editais/`, `lista-aprovados/`                                             | `src/modulos/editais/`, `cronograma/`, `aprovados/`       | ao tocar   |
| `src/modules/map-*`, `health-*`, `indigenous-*`, trechos do `legacy-app.js` (dashboard)                          | `src/modulos/visao-geral/`                                | 5          |
| `src/main.js`, `index.html`, `src/componentes/barra-lateral/`, `dados-do-monitoramento.js`, `usar-area-atual.js` | `src/app/` (entrada, layout, área atual)                  | 6          |
| `src/modules/legacy-app.js`, `auth-storage.js`, `sidebar-branding.js` (o login já está em `src/app/`)            | `src/app/`; o resto sai                                   | 6 (fase 2) |
| `src/modules/aya-*`                                                                                              | `src/app/` (Aya no layout)                                | 7          |
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

**Tela de página inteira** (modelos: `src/modulos/recursos/`, `src/modulos/selecao/`, `src/modulos/entrevistas/`, esta com visões num `Segmentado` no topo, e `src/modulos/analises/`): monta na `<section id="page-<view>">`
vazia do `index.html`, sem pedir nada ao banco; `src/main.js` guarda o controlador em `window`
(`recursosController`) e o legado chama `render()` ao navegar (tabela `TELAS_REACT` do `navigate`).
A área vem de `usarAreaAtual()`/`obterDadosDoMonitoramento()`, o tema de `usarTemaEscuro()`
(`src/app/tema.js`), o aviso de `window.monitoraToast` (passado na montagem). O título e a área
ficam no cabeçalho do app (`setPageTitle`); a tela não repete.

## Como usar `ui/`

Importe do índice: `import { Kpi, GradeDeKpis, Aviso } from "../../ui/index.js";`. O `ui.css` é
importado uma vez no ponto de entrada (`src/main.js`); o CSS próprio de um módulo de
`src/modulos/` entra no `src/main.js` logo depois.

Os componentes emitem só classes `.ui-*` (prefixo para não colidir com `.panel`,
`.kpi`, `.card`… de `app.css`) e nenhum id fixo. Peças de layout em CSS, sem componente:
`.ui-tela` (raiz da tela), `.ui-card`, `.ui-titulo`, `.ui-linha-de-cards` (dois cards lado a lado),
`.ui-pilha` (card com título e lista embaixo),
`.ui-grade-de-campos`, `.ui-acoes`, `.ui-gaveta-contexto`, `.ui-gaveta-corpo`, `.ui-gaveta-rodape`,
`.ui-texto-principal`/`.ui-texto-secundario` (célula), `.ui-secao-texto`/`.ui-secao-vazio`,
`.ui-esqueleto` (skeleton) e `.btn.small`/`.btn.danger` dentro de `.ui-tela`/`.ui-gaveta`.

| Componente                           | API (uma linha)                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TopoDoPainel`                       | `{ visoes?, status, aoAtualizar, atualizarDesativado?, aoExportar?, exportarDesativado?, children? }` — sem título, tema nem tela cheia (são do app); filhos são botões extras                                                                                                                          |
| `PainelDeFiltros`                    | `{ idDoTitulo, className?, recolhivel = true, quantos, escopo = "Todos", podeLimpar?, aoLimpar, aoRecolher?(recolhido), children }` — "Refinar resultados" com resumo, recolher e Limpar tudo                                                                                                           |
| `ChipsDeFiltro` / `ChipDeFiltro`     | `{ children }` / `{ rotulo, aoTirar, children }` — filtros aplicados                                                                                                                                                                                                                                    |
| `Kpi`                                | `{ cor?, tom?, icone?, rotulo, valor, chave, titulo?, ativo?, aoClicar?, carregando? }` — card de 78px, tile do ícone no tom; com `aoClicar` vira botão (filtro com `ativo`, atalho sem); `carregando` = skeleton                                                                                       |
| `GradeDeKpis`                        | `{ id?, className?, rotulo, children }`                                                                                                                                                                                                                                                                 |
| `CardDeGrafico`                      | `{ titulo, altura? ("short", "alto"), carregando?, className?, elemento = "article", children }` — sem sobretítulo nem dica                                                                                                                                                                             |
| `Grafico` / `paletaDosGraficos`      | `{ tipo, montar() → { data, options }, dependencias, rotulo, id?, plugins? }` — Chart.js criado uma vez e atualizado; `paletaDosGraficos(escuro, reserva)` lê as cores dos tokens                                                                                                                       |
| `TabelaInfinita`                     | `{ idDoTitulo, titulo, busca: { placeholder, rotulo, valor?, aoMudar? }, carregado, itens, filtrarPelaBusca, colunas, classeDaTabela?, linha(item), informacao(quantos \| null), total, vazio }` — 50 por vez, mais 50 ao rolar ou no "Carregar mais"; busca controlável; avisa `agsus:content-updated` |
| `Gaveta`                             | `{ id, tituloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, sobretitulo?, titulo, resumo?, rotuloDoFechar, children }` — encostada à direita                                                                                                                                          |
| `TopoDaGaveta`                       | `{ sobretitulo?, titulo, tituloId, resumo?, aoFechar, rotuloDoFechar }` — quando o topo fica dentro de um `<form>`; `usarClassesDaGaveta()` dá as classes do fundo e do cartão para um `<Modal>` direto                                                                                                 |
| `Secao` / `Kv` / `GradeDeKv`         | `{ icone, titulo, secao, children }` / `{ rotulo, children }` (vazio vira "—") / `{ className?, rotulo?, children }` — o detalhe na gaveta                                                                                                                                                              |
| `Modal`                              | `{ id, rotuloId, aoFechar, fecharAoClicarFora?, className?, cartaoClassName?, children }` — portal, Esc, foco preso                                                                                                                                                                                     |
| `Aviso`                              | `{ tom? ("info" \| "warning" \| "danger"), papel?, como = "div", className?, children }`                                                                                                                                                                                                                |
| `Campo`                              | `{ rotulo, erro?, dica?, obrigatorio?, largo?, idDoControle?, children }` — liga o rótulo ao 1º controle (ou ao `idDoControle`)                                                                                                                                                                         |
| `Selo`                               | `{ tom = "neutro" ("aprovado", "reprovado", "pendente", "revisar"), titulo?, className?, children }`                                                                                                                                                                                                    |
| `EstadoVazio` / `Carregando`         | `{ className?, children }` — `.ui-vazio`                                                                                                                                                                                                                                                                |
| `Segmentado`                         | `{ rotulo, opcoes: [{ valor, rotulo, icone? }], valor, aoMudar, desabilitado?, className? }` — radiogroup, setas ← → movem a escolha (visões de Entrevistas no topo, escala, comparecimento)                                                                                                            |
| `LinhaDoRecorte` / `MarcasDoRecorte` | `{ ativos?: [[campo, rótulo, valor]], texto?, children? }` — "Recorte ativo: …" ou "Sem filtros" (`textoDoRecorte(ativos)`; `texto` troca a frase); filhos abaixo / `{ marcas: [{ chave, tom?, icone?, texto }] }` — as marcas (sucesso, alerta, neutro)                                                |
| `ListaDePendencias`                  | `{ itens: [{ chave, titulo, detalhe, tom? ("alerta" \| "perigo"), ativo?, aoClicar }], carregando?, vazio }` — botões que filtram (`ativo` → `aria-pressed`) ou abrem uma lista; skeleton                                                                                                               |
| `MaisOpcoes`                         | `{ id, aberto, aoAlternar, quantos?, titulo, children }` — botão "Mais opções" com a contagem e o bloco dos filtros adicionais (controlado)                                                                                                                                                             |
| `classes(...)`                       | junta classes ignorando as vazias                                                                                                                                                                                                                                                                       |

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

### Sessão ↔ legado (o contrato da fase 1)

`sessaoDoApp.obter()` devolve `{ fase, usuario, perfil, painelIds, contextoCarregado, mensagem,
entrando, erroDeConfiguracao, consultarPedido, configuracao }`, com `fase` em `FASES`:
`iniciando` → `deslogado` | `abrindo` → `conectado` | `sem-acesso`.

- **O legado recebe** usuário e perfil por assinatura (`sessaoDoApp.assinar(receberSessao)`):
  `currentUser`, `profile` e `allowedPanelIds` do `legacy-app.js` são cópias locais. O React lê
  `sessaoDoApp.obter()` (a busca global já lê; `window.getMonitoraUser`/`getMonitoraProfile` ficam
  para as telas que ainda os usam).
- **O legado empurra a configuração**: `applyConfigToUi()` chama
  `sessaoDoApp.definirConfiguracao(appConfig)` (domínios, Google ligado, texto do botão, dica de
  domínio, mensagem de senha) e `definirMarcaDaConfiguracao({ valores, carregou, chaves })`.
- **A sessão chama o legado** pelos ganchos de `sessaoDoApp.ligarSistema({...})`, registrados no
  fim do `legacy-app.js`:

| Gancho                 | Quando                                        | O legado faz                                                           |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| `carregarConfiguracao` | no arranque, antes de olhar a sessão          | `loadConfig({ silent: true })`                                         |
| `mostrarEsqueleto`     | retorno do Google com `?code=`                | skeleton no formato da última tela                                     |
| `aoVerificar`          | sessão válida, antes de consultar o perfil    | skeleton + começa a ler a cópia da sessão (`prepararEntrada`)          |
| `abrir`                | perfil confirmado; `true` = sistema aberto    | `loadInitialData`, `openApp`, navegação, auditoria, presença, Realtime |
| `aoFicarSemAcesso`     | sem perfil ativo                              | apaga a cópia, para Realtime e heartbeat, esconde `#appScreen`         |
| `aoAtualizarPerfil`    | `USER_UPDATED` com o sistema aberto           | permissões dos painéis, menu, volta à tela inicial se preciso          |
| `antesDeSair`          | botão Sair, antes do `signOut()`              | auditoria `logout`, para o Realtime, apaga o cache de análises         |
| `aoSair`               | estado deslogado aplicado (uma vez por saída) | limpa linhas, presença, painéis externos, esconde `#appScreen`         |
| `aoLimparSessao`       | "Voltar ao login" do pedido                   | apaga a cópia da sessão                                                |
| `encerrarEspera`       | fim de toda entrada (deu certo ou não)        | esconde o skeleton e tira `body.config-loading`                        |

`#loginScreen` e `body.access-request-mode` são da entrada (`ligarEntradaAPagina`, pela fase);
`#appScreen` ainda é do legado (`openApp`), porque a navegação precisa da tela visível.

Melhorias de comportamento: a mensagem do domínio recusado e a da recuperação de senha deixaram de
se perder (o `SIGNED_OUT` do próprio `signOut()` aplicava a saída antes, com a frase genérica); o
botão do Google fica ocupado enquanto a janela do Google está aberta (antes o `signOut` local o
liberava na hora); sair continua mesmo se a auditoria falhar; entrar sem `SIGNED_IN` nesta aba
encerra a transição de saída; o pedido de acesso começa vazio para outra conta.

### Fase 2 (plano): navegação, carga dos dados e o fim do `legacy-app.js`

Cada passo é um PR pequeno, e o legado encolhe a cada um:

1. **Layout em `src/app/`**: `#appScreen` (cabeçalho, barra lateral, conteúdo) vira o layout React;
   `openApp`/`limparEstadoDeslogado` saem e a visibilidade segue a fase da sessão, como o
   `#loginScreen`. `src/componentes/barra-lateral/`, `dados-do-monitoramento.js` e
   `usar-area-atual.js` mudam para `src/app/`.
2. **Navegação**: `navigate`, `TELAS_REACT`, `startView`/`systemHomeView`/`isViewAllowed`,
   `rememberView`, `setPageTitle` e a guarda de saída das Configurações → um roteador simples em
   `src/app/rotas.js` (estado + `history`), com `paginasPermitidas` de `src/lib/access-roles.js`. Os
   controladores em `window` (`recursosController`…) viram rotas; `window.navigate` sai.
3. **Configuração e carga da entrada**: `loadConfig`/`applyConfigToUi`, `loadPanels`,
   `loadPanelPermissions`, catálogo de abas, situação do sistema, `iniciarConsultasDaSessao`, cópia
   da sessão (`copia-da-sessao-indexeddb.js`) e `refreshData` → `src/app/carga.js`, que a sessão
   chama no lugar do gancho `abrir`; `dados-do-monitoramento.js` passa a ser preenchido por ele.
4. **Presença, auditoria e Realtime**: `trackAccess`, heartbeat, presença online (o popover e a
   parte de `nielsen-shell-ux.js`), Realtime do monitoramento e `session-lifecycle.js` →
   `src/app/presenca.js` e um componente no cabeçalho; os ganchos `antesDeSair`/`aoSair` somem.
5. **O resto do `legacy-app.js`** (o mapa e a Visão geral são da Etapa 5): painéis externos
   (`openPanel`, `buildExternalPanel`, `reloadExternal`), exportar PDF, tela cheia, tema escuro
   (`toggleDarkMode`, `applyStoredDisplayModes`), barra recolhida (`toggleSidebar`,
   `enforceResponsiveSidebar`), aviso global e `friendlyError` → `src/app/` e `src/lib/`. Os
   `onclick` do `index.html` saem junto.
6. **Limpeza final**: `legacy-app.js`, os `window.*` de compatibilidade (`getMonitoraProfile`,
   `monitoraToast`, `$`…); o CSS da tela de acesso espalhado (`app.css`, `platform-shell.css`,
   `post-152-regression-fixes.css`, `visual-polish.css`, `mobile-app.css`) consolidado em
   `src/app/entrada/entrada.css` com tokens; `auth-storage.js` → `src/lib/`, `sidebar-branding.js`
   → barra lateral.

Ficou para a fase 2 de propósito: o CSS da tela de acesso (mexer agora mudaria a identidade visual
configurável e os testes de contraste) e o `#appScreen` (a navegação do legado depende dele).
