---
tipo: referencia
area: front
atualizado: 2026-11-18
---

# PWA e modo sem rede

O Yeendé é um PWA: instala no celular e no computador pelo navegador, sem app nativo (decisão
de 17/11/2026). Esta nota diz o que o service worker guarda, o que abre sem internet e onde mexer.

## Arquivos

| Arquivo                                          | O que faz                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `sw.js`                                          | o service worker: casca, arquivos do build e estratégia de cada pedido       |
| `sw-policy.js`                                   | a política pura (estratégia, o que se guarda, limite, hash), testada à parte |
| `src/lib/carga/cache-do-service-worker.ts`       | o que o build grava no `sw.js`: a versão e a lista `PRECACHE`                |
| `vite.config.js` (`copyProgressiveWebAppAssets`) | monta a lista e publica `sw.js`, `sw-policy.js`, `offline.html`, ícones      |
| `src/modules/pwa-lifecycle.ts`                   | registra o service worker; o novo só assume no "Atualizar" do aviso          |
| `src/app/casca/aviso-de-conexao.tsx`             | "Sem conexão com a internet" e "Conexão restabelecida"                       |

## O que o service worker guarda

- **Na instalação:** a casca (`APP_SHELL`: `/`, `offline.html`, manifesto, ícones) e
  **todos os arquivos publicados** que uma tela precisa para abrir: JS, CSS, fontes e imagens do
  build, de `public/` e de `icons/` (`PRECACHE`, cerca de 120 arquivos e 1,7 MB pela rede). Assim
  qualquer tela abre sem rede, também a que nunca foi aberta.
- **Fora da lista:** os JSON de `public/data/` (3,5 MB de contornos de terras e DSEIs; o mapa sem
  rede também não tem os mosaicos), o modelo `.xlsx` e mapas de código.
- **Na troca de versão**, o arquivo com hash do Vite no nome que a versão anterior já guardou é
  copiado de lá (`isHashedAsset`), sem baixar de novo; o resto vem da rede. Um arquivo que falhar
  não impede a instalação: entra no cache quando a tela for aberta com rede.
- **A casca sem redirecionamento:** a Vercel responde 308 a `/index.html` e a `/offline.html`
  (`cleanUrls`), e uma resposta redirecionada não serve para responder a uma navegação (o navegador
  mostra a página de erro). Por isso a casca não tem `/index.html` (a navegação sem rede cai em `/`)
  e `guardarCasca` guarda o corpo do que veio redirecionado como resposta direta.
- **Pelo uso:** arquivo com hash do Vite no nome (`isHashedAsset`) é cache primeiro (o nome muda
  quando o conteúdo muda); navegação e os demais scripts e estilos são rede primeiro, e a cópia
  guardada vale também quando a rede responde erro (404, 500: `prefersCachedCopy`); imagens,
  fontes e manifesto, cache primeiro. O limite de 150 entradas (`CACHE_LIMIT`,
  `entriesBeyondLimit`) vale só para o que entrou pelo uso: casca e `PRECACHE` nunca saem.
- **Nunca:** outro domínio (o Supabase), `/auth/`, `/api/`, `/rest/`, `/storage/`, `/functions/`,
  pedido com `Authorization` e resposta `private`/`no-store`.
- A busca no cache ignora o `Vary` (o `vite preview` manda `Vary: Origin`): sem isso, o módulo
  pedido com `Origin` não achava a cópia guardada na instalação.
- Cada build tem cache próprio (`agsus-monitora-<versão>-static`); o `activate` herda os arquivos
  com hash da versão anterior (abaixo) e apaga os caches antigos.

## Aba aberta durante a publicação

Muitas publicações por dia, e a Vercel (plano Hobby, sem "skew protection") só tem a versão no ar:
o pedaço da versão anterior responde 404. A aba que atravessou a publicação ainda roda o código
anterior e o pede ao abrir uma tela pela primeira vez. Antes de 18/11/2026 a tela ficava parada
("Não foi possível carregar esta tela", ou preta) até um Ctrl+Shift+R. As camadas, nesta ordem:

1. **Service worker da versão anterior:** o pedaço vem do cache (cache primeiro para arquivo com
   hash; antes, rede primeiro devolvia o 404 mesmo com a cópia guardada).
2. **Service worker novo já no comando** (alguém aceitou a versão nova noutra aba): o
   `activate` copia para o cache novo os arquivos com hash da versão anterior que a nova não tem
   (`entriesToCarry`), antes de apagar o cache anterior. Entram no limite de 150; os herdados de
   versões mais velhas saem primeiro.
3. **Sem o pedaço (sem service worker, cache apagado):** a tela recarrega uma vez
   (`importarComRecarga`). A falha do CSS da tela ("Unable to preload CSS", do Vite) conta como
   falha de carregamento; antes não contava e a recarga não acontecia.
4. **Outro `import()` fora das telas** (modal do edital, Aya, PDF): o Vite dispara
   `vite:preloadError` e o aviso de versão vira "Atualize para continuar", com "Atualizar"
   (`src/app/aviso-de-versao.ts`; não recarrega sozinho, porque pode haver algo digitado).

## Quando o service worker novo assume

Como no SIGAV: só quando a pessoa aceita. Instalado, o novo fica esperando
(`registration.waiting`) e a página segue com o anterior e o cache dele (a camada 1 acima). O
"Atualizar" do aviso de versão chama `aplicarVersaoNova` (`src/modules/pwa-lifecycle.ts`): manda
`SKIP_WAITING` ao que espera, o controlador troca e a página recarrega uma vez; se a troca não vier
em 4 s, recarrega assim mesmo, e nunca duas vezes. Sem service worker esperando, recarrega na hora
(a navegação é rede primeiro, então vem a versão nova). Antes de 23/11/2026 a própria página mandava
o `SKIP_WAITING` assim que o novo instalava. O novo assume todas as abas: nas que não pediram, a
recarga espera a próxima troca de página (`aplicarAtualizacaoPendente`, depois da guarda de
alterações não salvas). Fechar todas as abas também o põe no comando (regra do navegador).

## Dados sem rede

Os dados vêm do Supabase, em outro domínio, e nunca passam pelo service worker. Sem rede, as telas
usam a cópia que guardaram no IndexedDB na última leitura com rede (o que leva e por quanto tempo:
[[dados-pessoais]]):

| Tela                                                           | Sem rede, com cópia                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Análises, Seleção, Entrevistas › Resultados                    | a cópia; o status do topo vira "Dados de 17/11, 10:14"             |
| Lista de aprovados                                             | a cópia (candidatos e listas da área), com a mesma data            |
| Entrevistas › Conduzir (fila e ficha)                          | a lista de editais e o edital aberto, com a data ao lado do edital |
| Avaliação documental, Classificação, Conferências, Visão geral | ainda o erro (ou a cópia da sessão, na Visão geral)                |

- A data (`src/lib/carga/rotulo-da-copia.ts`) aparece uma vez só, no lugar da data de atualização; sai quando a versão
  nova chega. Sem cópia, o erro de sempre ("Não foi possível falar com o servidor…").
- A cópia é lida quando a falha é de conexão (`ehFalhaDeConexao`); erro do banco ou de permissão
  continua erro, e 42501/22023 apagam as cópias.
- Gravar (notas, convocação, status) exige rede: lançar notas sem rede é a fase 3, ainda não feita.
- **"Levar para o campo"** (Conduzir entrevistas, edital aberto): relê o edital com rede e confirma
  a cópia ("Pronto para o campo … neste aparelho até 19/11, 10:14"). Quem avalia leva só a sua banca;
  a coordenação, o edital inteiro; o cálculo da convocação não vai (`src/lib/entrevistas/conducao-para-o-campo.ts`,
  a mesma regra da cópia automática).

## Entrar sem rede

Decisão de 17/11/2026, para o trabalho de campo (`src/lib/sessao/sessao-sem-rede.ts`):

- **Sessão:** o token vence em 1 h; vencido e sem rede, o `getSession()` do auth-js devolve `null`
  embora a sessão continue guardada. O cliente (`src/lib/sessao/supabaseClient.ts`) passa a devolver a
  guardada quando a renovação falha por falta de rede, por até 48 h depois de vencer. Recusa do
  servidor segue como sessão encerrada.
- **Perfil:** a entrada sempre consulta o perfil; se a consulta falha por falta de rede, serve o perfil
  guardado na última entrada com rede (`src/app/perfil-guardado.ts`, cópia de 48 h, de um usuário
  só). O estado da sessão fica com `semRede: true`.
- **A rede voltou** (evento `online`): o perfil é conferido no banco. Sem acesso, o app fecha e as
  cópias saem (`ficarSemAcesso`); com acesso, `semRede` volta a `false`.
- Risco aceito: quem teve o acesso retirado ainda vê, sem rede, o que já estava no aparelho, por até
  48 h.

## Testes

- `tests/editais-cargas-e-paineis.test.js` (bloco `service-worker-policy`): estratégia, limite com os arquivos fixos, hash e a lista
  do build.
- `tests/editais-cargas-e-paineis.test.ts` (bloco `copias-no-aparelho`): 48 h, data da cópia, apagar a vencida (leitura e varredura).
- Sem rede em cada tela: `tests/telas-com-modulo-simulado-na-tela.test.js` (bloco `modulos/entrevistas`), `selecao.test.js`,
  `analises-consultas.test.js`, `tests/entrevistas-e-aprovados-na-tela.test.ts` (bloco `componentes/lista-aprovados`) e
  `tests/entrevistas-e-aprovados.test.ts` (bloco `modulos/conducao-sem-rede-abre-a-copia`).
- Entrada sem rede: `tests/demais-regras.test.ts` (bloco `sessao-sem-rede`) (a regra) e `tests/casca-sessao-e-interface-na-tela.test.ts` (bloco `app/sessao`)
  ("entrar sem rede"); "Levar para o campo": `tests/entrevistas-e-aprovados.test.ts` (bloco `conducao-para-o-campo`).
- `tests/pwa-sem-rede.spec.js`, bloco "aba aberta durante a publicação": servidor que imita a
  Vercel (`tests/apoio/vercel-simulada.js`: 308, 404, `rewrites`) e uma publicação que troca o hash
  de todos os pedaços; sem service worker (recarrega uma vez), com o anterior (pedaço do cache, sem
  recarga) e com o novo já no comando (a herança).
- `tests/pwa-sem-rede.spec.js` (Playwright, build simulado): abre o app, espera o service worker
  terminar de guardar, desliga a rede (`context.setOffline(true)`) e troca para o Cronograma, que
  nunca foi aberto; depois dá F5 sem rede (com o Supabase simulado). O segundo teste derruba a
  leitura do painel de Entrevistas e confere a cópia com "Dados de …" na tela.

## Conferir à mão

DevTools → Application → Service workers e Cache storage (`agsus-monitora-…-static` com os
arquivos do build); Network → Offline; trocar de tela e recarregar.

## Relacionadas

- [[servidor-web]] — o que o servidor publica
- [[deploy-e-vercel]] — a versão do build
- [[testes]] — Playwright e o build simulado
- [[dados-pessoais]] — o que as cópias levam e quando saem
