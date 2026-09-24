/*
  Estado da barra lateral, fora do React.

  O legado continua decidindo o que o perfil vê e qual página está aberta
  (`buildNav` e `setActiveNav`, em `legacy-app.js`); ele só empurra isso para
  cá, e os componentes leem com `useSyncExternalStore`. Este arquivo não
  importa React: o legado pode importá-lo sem puxar o React para o grafo dele.

  Quando o resto do front migrar para React, este estado vira estado do app.
*/

const ATIVO_VAZIO = Object.freeze({ view: null, secao: null });

const ESTADO_INICIAL = Object.freeze({
  arvore: Object.freeze([]),
  ativo: ATIVO_VAZIO,
  opcoes: Object.freeze({}),
});

let estado = ESTADO_INICIAL;
const ouvintes = new Set();

function publicar(proximo) {
  estado = proximo;
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarBarraLateral(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function obterEstadoDaBarraLateral() {
  return estado;
}

/*
  `arvore` vem de `montarArvoreDoMenu` (`src/lib/menu-lateral.js`). Opções:
  - `navegar(view)`: padrão, `window.navigate` resolvido no clique;
  - `paginaAtiva(view)`: padrão, `#page-<view>` com `.active`;
  - `aoAbrirSecao(view, secao)`: depois de abrir um item com seção;
  - `textoVazio`: aviso quando o perfil não tem nenhuma área.
*/
export function atualizarMenuLateral(arvore = [], opcoes = {}) {
  publicar({ ...estado, arvore, opcoes });
}

export function marcarItemAtivoNoMenu(view, secao = null) {
  const proximo = { view: view ?? null, secao: secao ?? null };
  if (
    estado.ativo.view === proximo.view &&
    estado.ativo.secao === proximo.secao
  ) {
    return;
  }
  publicar({ ...estado, ativo: proximo });
}

/* Só para os testes: volta ao estado de antes do primeiro `buildNav`. */
export function redefinirBarraLateral() {
  publicar(ESTADO_INICIAL);
}
