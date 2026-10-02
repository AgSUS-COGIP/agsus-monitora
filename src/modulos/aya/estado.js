/*
  Onde a pessoa está, para a Aya: a página aberta (view do legado e título do
  cabeçalho), a área atual do app e, em Configurações, a seção aberta.

  Sem React (o legado importa daqui): `setPageTitle` do legacy-app.js chama
  `definirPaginaDaAya` a cada navegação; a área vem de
  `dados-do-monitoramento.js` (trocar de área no menu avisa aqui) e a seção,
  do evento que `configuracoes/secoes.js` dispara ao abrir cada seção. O componente
  lê com `useSyncExternalStore(assinarPaginaDaAya, obterPaginaDaAya)`.
*/

import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.js";
import {
  EVENTO_SECAO_ABERTA,
  secaoAtualDeConfiguracao,
} from "../configuracoes/secoes.js";

const ouvintes = new Set();

const areaAtual = () => obterDadosDoMonitoramento().areaAtual || "";

let estado = Object.freeze({
  view: "",
  titulo: "",
  secao: "",
  area: areaAtual(),
});

function publicar(mudancas) {
  const proximo = { ...estado, ...mudancas };
  if (Object.keys(proximo).every((chave) => proximo[chave] === estado[chave]))
    return;
  estado = Object.freeze(proximo);
  for (const ouvinte of ouvintes) ouvinte();
}

export const obterPaginaDaAya = () => estado;

export function assinarPaginaDaAya(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** O legado navegou: a view (`dashboard`, `recursos`, `config`…) e o título do cabeçalho. */
export function definirPaginaDaAya(
  view,
  titulo = "",
  documento = globalThis.document,
) {
  const chave = String(view || "").trim();
  publicar({
    view: chave,
    titulo: String(titulo || "").trim(),
    secao: chave === "config" ? secaoAtualDeConfiguracao(documento) : "",
    area: areaAtual(),
  });
}

assinarDadosDoMonitoramento(() => publicar({ area: areaAtual() }));

globalThis.document?.addEventListener(EVENTO_SECAO_ABERTA, (evento) => {
  if (estado.view !== "config") return;
  publicar({ secao: String(evento.detail?.secao || "") });
});

/** Só para os testes: volta ao estado inicial. */
export function redefinirPaginaDaAya() {
  estado = Object.freeze({
    view: "",
    titulo: "",
    secao: "",
    area: areaAtual(),
  });
  for (const ouvinte of ouvintes) ouvinte();
}
