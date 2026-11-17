---
tipo: referencia
area: front
atualizado: 2026-11-17
---

# PWA e modo sem rede

O Yeendé é um PWA: instala no celular e no computador pelo navegador, sem app nativo (decisão
de 17/11/2026). Esta nota diz o que o service worker guarda, o que abre sem internet e onde mexer.

## Arquivos

| Arquivo                                          | O que faz                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `sw.js`                                          | o service worker: casca, arquivos do build e estratégia de cada pedido       |
| `sw-policy.js`                                   | a política pura (estratégia, o que se guarda, limite, hash), testada à parte |
| `src/lib/cache-do-service-worker.ts`             | o que o build grava no `sw.js`: a versão e a lista `PRECACHE`                |
| `vite.config.js` (`copyProgressiveWebAppAssets`) | monta a lista e publica `sw.js`, `sw-policy.js`, `offline.html`, ícones      |
| `src/modules/pwa-lifecycle.ts`                   | registra o service worker e aplica a versão nova na próxima troca de página  |
| `src/app/casca/aviso-de-conexao.tsx`             | "Sem conexão com a internet" e "Conexão restabelecida"                       |

## O que o service worker guarda

- **Na instalação:** a casca (`APP_SHELL`: `/`, `index.html`, `offline.html`, manifesto, ícones) e
  **todos os arquivos publicados** que uma tela precisa para abrir: JS, CSS, fontes e imagens do
  build, de `public/` e de `icons/` (`PRECACHE`, cerca de 120 arquivos e 1,7 MB pela rede). Assim
  qualquer tela abre sem rede, também a que nunca foi aberta.
- **Fora da lista:** os JSON de `public/data/` (3,5 MB de contornos de terras e DSEIs; o mapa sem
  rede também não tem os mosaicos), o modelo `.xlsx` e mapas de código.
- **Na troca de versão**, o arquivo com hash do Vite no nome que a versão anterior já guardou é
  copiado de lá (`isHashedAsset`), sem baixar de novo; o resto vem da rede. Um arquivo que falhar
  não impede a instalação: entra no cache quando a tela for aberta com rede.
- **Pelo uso:** navegação, scripts e estilos são rede primeiro (com a cópia de reserva); imagens,
  fontes e manifesto, cache primeiro. O limite de 150 entradas (`CACHE_LIMIT`,
  `entriesBeyondLimit`) vale só para o que entrou pelo uso: casca e `PRECACHE` nunca saem.
- **Nunca:** outro domínio (o Supabase), `/auth/`, `/api/`, `/rest/`, `/storage/`, `/functions/`,
  pedido com `Authorization` e resposta `private`/`no-store`.
- A busca no cache ignora o `Vary` (o `vite preview` manda `Vary: Origin`): sem isso, o módulo
  pedido com `Origin` não achava a cópia guardada na instalação.
- Cada build tem cache próprio (`agsus-monitora-<versão>-static`); o `activate` apaga os antigos.

## Dados sem rede

Os dados vêm do Supabase, em outro domínio, e nunca passam pelo service worker. As cópias que as
telas guardam no IndexedDB, e por quanto tempo, estão em [[dados-pessoais]].

## Testes

- `tests/service-worker-policy.test.js`: estratégia, limite com os arquivos fixos, hash e a lista
  do build.
- `tests/pwa-sem-rede.spec.js` (Playwright, build simulado): abre o app, espera o service worker
  terminar de guardar, desliga a rede (`context.setOffline(true)`) e troca para o Cronograma, que
  nunca foi aberto; depois dá F5 sem rede (com o Supabase simulado: de verdade, a entrada sem rede
  ainda falha ao conferir o perfil, "Não foi possível verificar suas permissões").

## Conferir à mão

DevTools → Application → Service workers e Cache storage (`agsus-monitora-…-static` com os
arquivos do build); Network → Offline; trocar de tela e recarregar.

## Relacionadas

- [[servidor-web]] — o que o servidor publica
- [[deploy-e-vercel]] — a versão do build
- [[testes]] — Playwright e o build simulado
