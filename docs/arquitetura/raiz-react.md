---
tags:
  - tipo/arquitetura
  - area/front
---

# Raiz React única e rotas no endereço

Status: **em andamento** (passo 1 neste PR). Complementa `docs/arquitetura-react.md` (regras dos
módulos, `src/ui/`, casca) e `docs/arquitetura.md` (banco, áreas e permissões).

Objetivo: o MONITORA vira **um** app React — um `createRoot` só, a área e a tela no endereço
(`/saude-indigena/cronograma`), voltar/avançar do navegador e recarregar funcionando, link que se
compartilha. Sem mudança em quem vê o quê.

## 1. Como é hoje (antes do passo 1)

### Quem decide a tela

- `src/main.ts` monta, em ordem, **várias raízes React** (`montarModulo` = `createRoot` +
  `StrictMode` + `ErrorBoundary`): avisos (`#avisosApp`), casca (`#appScreen`), entrada
  (`#telaDeEntrada`), barra lateral (`aside.sidebar`), Visão geral (`#page-dashboard`), Editais
  (`#page-nucleo`) e, sob demanda, as outras telas. Fora dele montam outras ilhas: Pessoas online,
  aviso de versão, encerramento e selos do edital (`src/app/sistema.ts`), Aya e mascote (depois
  de entrar), busca global, Configurações e as seções Acessos, Módulos e abas, Status das
  atualizações e Automação. São **27 chamadas a `createRoot`**.
- A casca (`src/app/casca/`) desenha uma vez as `<section class="page" id="page-<view>">` vazias.
- `src/app/navegacao.ts` (`criarNavegacao`, publicada em `window.navigate`) troca a tela à mão:
  confere a saída (`confirmarSaida`), a versão nova esperando (`aplicarAtualizacao`), a permissão
  (`bloqueioDaTela`), tira `.active` de todas as `.page` (`querySelectorAll`), põe na pedida,
  escreve o título em `#pageTitle`/`#pageSubtitle` e chama `window.<tela>Controller.render()`
  (tabela `TELAS_REACT`). A tela aberta só fica no `localStorage` (`CHAVE_DA_TELA_GUARDADA`) e a
  área no `sessionStorage`; **o endereço não muda nunca** (voltar do navegador sai do app).
- Cada tela é um `montarX({ secao, toast… })` que cria o estado (store fora do React) e monta
  numa raiz própria; devolve o controlador (`render()`, `abrirVisao()`, `abrirEdital()`,
  `estado`, `raiz`).

### Telas sob demanda

`src/app/tela-sob-demanda.ts`: `window.<tela>Controller = telaSobDemanda({ secao, metodos,
carregar })` devolve um `Proxy` que, no primeiro `render()`, baixa o módulo (`import()`
envolvido por `importarComRecarga`, que recarrega a página uma vez se a versão publicada mudou),
escreve "Carregando…" na seção pelo DOM e, na falha, "Tentar de novo". `registrarPreCarga` baixa
ao passar o mouse no item do menu. `comecarCargaDeTela`/`haTelaCarregando` deixam o tour da Aya
esperar a tela.

### Menu, áreas e permissões

- O catálogo de abas (`TB_ABA`, por área, do Supabase: `src/modules/catalogo-de-abas.ts`) e a
  situação (manutenção, desligadas) chegam na carga; `navegacao.montarMenu()` monta a árvore com
  `montarArvoreDoMenu` (`src/lib/menu-lateral.ts`) a partir de `paginasPermitidas(perfil)`
  (`src/lib/access-roles.ts`) e entrega ao estado da barra (`atualizarMenuLateral`).
- O administrador global passa por todas as regras (`access-roles.ts`).
- A área atual mora em `src/componentes/dados-do-monitoramento.ts` (`definirAreaAtual`). Trocar de
  área no menu: a barra troca a área **antes** de chamar `window.navigate(view)` e desfaz se a
  navegação for recusada (`destinoAoTrocarDeArea`: a mesma página na área nova, ou a primeira).
- Página desligada ou em manutenção: `aplicarManutencaoNaNavegacao` (legado,
  `src/modules/situacao-dos-modulos.ts`) põe o aviso no lugar da página;
  `vigia-do-catalogo.ts` reavalia no meio da sessão (`reavaliarTelaAtual`).

### Sessão, carga e presença

- `sessaoDoApp` (`src/app/sessao.ts`) cuida da entrada; `ligarSistema()` registra os ganchos
  (`abrir`, `aoSair`…). Ao abrir, `carga.carregarEntrada()` monta o menu e chama
  `navegacao.irPara(navegacao.telaDeEntrada())` (a guardada, se permitida, senão a inicial).
- "Atualizar dados" e mudança do catálogo reabrem a tela atual (`irPara(view)`), o que chama
  `render()` de novo.
- Presença e auditoria (`src/app/presenca.ts`) assinam a navegação: `{ tipo: "menu" }` a cada
  marcação e `{ tipo: "abertura" }` a cada tela. Como as duas chegam numa troca de tela,
  `registrar_navegacao_monitora` sai **duas vezes** por navegação.
- `src/app/pagina-aberta.ts` pede as linhas do monitoramento só para as telas que as usam.
- Aba em segundo plano por 2 min: `agsus:background-suspend` para heartbeat e Realtime;
  `agsus:background-resume` retoma (`src/lib/background-resource-lifecycle.ts` → `sistema.ts`).

### Aya, links internos, PWA

- Tours "Primeira vez em …" (`src/modulos/aya/tour/`) trocam de tela por `window.navigate` e
  esperam a tela carregar (`haTelaCarregando`).
- Links internos ("Ir para…"): `src/app/ir-para-tela.ts` navega e depois chama o controlador da
  tela (`classificacaoController.estado.escolherEdital`, `conduzirEntrevistasController.abrirEdital`,
  `preClassificacaoController.abrirEdital`). Editais chama `aprovadosController.openImportModal`;
  as Regras do edital chamam `nucleoController.abrirRegrasDoEdital`; a gaveta da Visão geral chama
  `nucleoController.estado.abrirLinhaDoTempo`.
- Endereço: só `?code=`/`?auth=` do OAuth (limpos por `sessao.ts`) e `/auth/callback`.
  **Não há deep link.**
- PWA: `sw.js` responde navegação com rede primeiro e, sem rede, o `/index.html` guardado — vale
  para qualquer caminho. A Vercel **não tem `rewrites`**: `/sede/cronograma` daria 404. O
  `server/servidor.ts` também só serve `/` e `/index.html`.

## 2. Para onde vai

- **Um `createRoot`**: `src/app/raiz.tsx` (`montarRaiz()`), num `#raiz` do `index.html`. Avisos,
  entrada e casca entram por **portal** nos lugares de sempre (`#avisosApp`, `#telaDeEntrada`,
  `#appScreen`), com os mesmos ids e classes (CSS, testes e tours continuam valendo). A barra
  lateral e as telas são filhas da casca. As ilhas que sobram (passo 2) viram filhas da raiz.
- **Rotas** `/:area/:tela[/:edital]` (`src/lib/rotas.ts`, regra pura com teste):

  | Tela (view)            | Endereço                                |
  | ---------------------- | --------------------------------------- |
  | `dashboard`            | `/saude-indigena/visao-geral`           |
  | `nucleo`               | `/sede/editais`                         |
  | `calendario`           | `/projetos/cronograma`                  |
  | `approved`             | `/…/aprovados`                          |
  | `recursos`             | `/…/painel-de-recursos`                 |
  | `analisar-recursos`    | `/…/recursos`                           |
  | `entrevistas`          | `/…/painel-de-entrevistas`              |
  | `conduzir-entrevistas` | `/…/entrevistas[/:edital]`              |
  | `classificacao`        | `/…/classificacao[/:edital]`            |
  | `analises`             | `/…/analises`                           |
  | `avaliacao-documental` | `/…/avaliacao-documental`               |
  | `pre-classificacao`    | `/…/triagem[/:edital]`                  |
  | `selecao`              | `/…/selecao`                            |
  | `config`               | `/administracao/configuracoes[/:secao]` |
  | `panel:<codigo>`       | `/paineis/<codigo>`                     |
  | `sem-acesso`           | `/sem-acesso`                           |

  `?visao=` leva a visão (`abrirVisao`) dos links antigos (`entrevistas:conduzir`). `/` abre a
  tela de entrada (a guardada ou a inicial) com `replaceState`.

  Os demais parâmetros da busca são os filtros da tela (`usarFiltrosNaUrl`/`usarLojaNaUrl`,
  `src/app/usar-filtros-na-url.ts`; regras em `src/app/filtros-no-endereco.ts`): Triagem
  (`edital`, `aba`, `situacao`, `vaga`, `motivo`), Avaliação documental (`edital`, `aba`,
  `etapa`, `vaga`, `modalidade`, `minhas`) e Classificação (`edital`, `aba`, `tipo`, `vaga`,
  `lista`, `situacao`). Edital, aba e etapa empilham; os outros trocam a entrada. O padrão não
  aparece, e a busca por nome ou CPF nunca vai à URL. A navegação guarda os filtros da tela e os
  devolve ao voltar a ela pelo menu; voltar/avançar dentro da mesma tela só troca os filtros.

- **Roteador próprio, sem dependência.** O React Router 7 (7.18.4, a mais nova com mais de duas
  semanas) somaria ~20 kB gzip à entrada, que já está em 304 de 320 kB; o app só precisa de
  `pushState`/`replaceState`/`popstate` e de um store lido com `useSyncExternalStore`.
  `src/app/endereco.ts` (~80 linhas) faz isso; a regra de caminho fica em `src/lib/rotas.ts`.
- **A navegação é um store** (`criarNavegacao`, sem DOM): `obter()` devolve `{ view, area,
visao, edital, secao, aviso, titulo, subtitulo, abertura }`; `assinar()` avisa a casca, a barra,
  a presença e a página aberta. `irPara(view, { edital, visao })` confere saída, versão nova e
  permissão, empilha o endereço e publica. O `popstate` (voltar/avançar) passa pelas mesmas
  guardas: recusado, o endereço volta para o da tela atual; tela proibida ou inexistente
  substitui o endereço pela tela de entrada e avisa. A área do endereço vira a área atual
  (`definirAreaAtual`) só se for do usuário; senão vale a atual.
- **As telas são rotas** (`src/app/telas.tsx`): cada tela tem `view`, caminho, título e um
  `carregar()` que devolve o controlador (`criarX(...)`: estado, conteúdo React, `render()`,
  `abrirVisao()`, `abrirEdital()`). O componente `<Telas>` desenha as `<section class="page">` e
  marca a ativa pelo store (nada de `querySelectorAll(".page")`); a tela visitada fica montada
  (o estado da tela — filtros, aba, rolagem — continua como hoje). Cada tela: `React.lazy` sobre
  `importarComRecarga` (recarga na versão nova), `Suspense` com "Carregando…" e `ErrorBoundary`
  com "Tentar de novo" (que refaz o `lazy`). Ao abrir (cada `abertura`), a rota chama `render()`
  — o mesmo contrato de hoje.
- **Quem chama outra tela** usa o registro (`src/app/registro-das-telas.ts`: `carregarTela(view)`)
  em vez de `window.<tela>Controller`; link com edital vai no endereço
  (`/…/classificacao/<id>`), e a rota chama `abrirEdital`.
- **Título** do cabeçalho vem do store da navegação (`Topo` lê com `useSyncExternalStore`), não de
  `textContent`.
- **Presença**: uma `abertura` por troca de endereço, um registro por navegação.
- **Hospedagem**: `vercel.json` ganha o `rewrite` das rotas do app para `/index.html` (arquivo
  com ponto, `/api`, `/assets`, `/auth`, `/icons` e `/data` ficam de fora); `server/servidor.ts`
  serve o `index.html` para caminhos de rota (sem ponto); o `sw.js` já cobre sem rede.
- **Deep link e login**: endereço de rota aberto sem sessão fica guardado no `sessionStorage`; o
  retorno do Google (`/?auth=google`) abre a tela pedida, se o perfil puder.

## 3. Ordem (cada PR deixa o app inteiro funcionando)

1. **Raiz e rotas, telas como rotas** (este PR): `rotas.ts`, `endereco.ts`, navegação como store
   com endereço, `telas.tsx` + registro, `raiz.tsx` (avisos, entrada, casca, barra lateral e telas
   numa raiz só), `criarX` no lugar de `montarX` nas 14 telas de página inteira, saem
   `TELAS_REACT`, os `window.<tela>Controller` das telas, o `telaSobDemanda` delas e o
   "Carregando…" escrito pelo DOM; `vercel.json`, servidor e testes.
2. **Ilhas para dentro da raiz** (feito): Pessoas online, aviso de versão, encerramento e selos
   são filhas da casca (`src/app/casca/pecas.tsx`), com o estado do sistema pelo contexto da raiz
   (`pecas`); a busca global é filha da raiz (sai o `#buscaGlobalApp`); a Aya baixa por
   `React.lazy` quando a sessão abre o app. A arara dos fogos e a cobertura do painel externo,
   que moram em DOM feito à mão, entram por **portais avulsos** da raiz
   (`src/app/portais-avulsos.tsx`) até os fogos e o quadro dos painéis serem React.
3. **Configurações como rota de verdade** (feito): a página (`src/app/telas.tsx`) desenha um
   `<article class="config-secao">` por seção, à vista só o da seção do endereço
   (`/administracao/configuracoes/:secao`); a moldura (`config`) e as seções com tela própria
   (`secao:acessos`, `secao:modulos`, `secao:cargas`, `secao:automacao`) são telas do registro, com
   `React.lazy`. A navegação guarda as seções permitidas e a última aberta, conta
   `aberturaDaSecao` (o `render()` da seção) e pergunta à seção antes de trocar. Saem
   `organizarConfiguracoesEmSecoes`, o evento `agsus:secao-de-configuracao-aberta`, os
   `window.<seção>Controller`, `tela-sob-demanda.ts` e `montar-modulo.tsx`.
4. **Regras do edital no endereço** (feito): `/:area/editais/:edital/regras/:etapa`. A navegação
   guarda `regras` (`{ edital, etapa }`); abrir por cima da tabela de Editais empilha uma entrada,
   trocar de etapa substitui e o "← Editais" volta pelo histórico (`endereco.voltar()`). Editais lê
   as regras da navegação; as outras telas abrem por `navigate("nucleo", { edital, regras })`.
   Sai a marca `monitoraRegrasDoEdital` no `history.state`.
5. **Avisos no lugar da página** (feito): a decisão é pura (`avisoDaPagina`,
   `src/lib/pagina-desligada.ts`), a navegação publica `manutencao` e `faixa`, e a rota desenha
   `#page-manutencao` e `#faixaDeManutencao` em React (`src/app/telas.tsx`). A situação do sistema
   (sem DOM) foi para `src/app/situacao-do-sistema.ts`; sai `src/modules/situacao-dos-modulos.ts`.
6. **Moldura como store** (feito): `src/app/moldura.ts` só muda estado (barra recolhida/aberta,
   tema, tela cheia, cabeçalho do PDF); a casca liga à página (`MolduraNaPagina`,
   `src/app/casca/pecas.tsx`: classes de `body`/`html`, eventos da barra, largura, tema de outra
   aba e tela cheia, desligados ao desmontar). O ícone da tela cheia e o cabeçalho do relatório são
   React. Os avisos (`#avisosApp`) vivem no `#raiz`. O index.html fica com o primeiro quadro: os
   scripts do `<head>` (marca da tela de acesso, sessão guardada → skeleton, barra e tema escuro), o
   skeleton, o cartão de entrada, `#appScreen` (escondido até a sessão abrir) e `#raiz`.

## 4. Riscos

| Risco                                                                          | Cuidado                                                                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Deep link 404 na Vercel                                                        | `rewrites` com teste que lê o `vercel.json`; servidor com teste de rota                              |
| Voltar do navegador com alteração não salva                                    | o `popstate` passa por `confirmarSaida`; recusado, o endereço volta (`pushState` da tela atual)      |
| Link compartilhado para tela que a pessoa não pode ver                         | mesma regra de hoje (`bloqueioDaTela`): aviso e tela de entrada, com `replaceState`                  |
| Área do endereço que não é da pessoa                                           | ignorada; vale a área atual dela                                                                     |
| Tela desmontada perde filtros                                                  | as telas visitadas continuam montadas, só a `.active` muda                                           |
| `render()` em dobro (StrictMode, reabertura)                                   | a rota guarda a última `abertura` atendida                                                           |
| Ordem de arranque (quem procura id logo depois)                                | a raiz desenha com `flushSync` antes de `ligarSistema()`, como a casca                               |
| PRs em paralelo (Regras do edital parte 2, limpeza da presença, casca parte D) | rebase frequente; `window.aprovadosController.carregar()` das Regras vira `carregarTela("approved")` |
| Orçamento de bundles                                                           | sem dependência nova; a entrada é medida antes e depois (`npm run check:bundle-size`)                |
| Marcas do histórico das Regras do edital (`pushState` sem mudar o endereço)    | `popstate` com o mesmo caminho não troca de tela                                                     |
