/*
  Onde a pessoa está, para a Aya: a página aberta (view do legado e título do
  cabeçalho), a área atual do app e, em Configurações, a seção aberta.

  Sem React: `definirTitulo` da navegação (src/app/navegacao.js) chama
  `definirPaginaDaAya` a cada navegação; a área vem de
  `dados-do-monitoramento.ts` (trocar de área no menu avisa aqui) e a seção,
  do evento que `configuracoes/secoes.ts` dispara ao abrir cada seção. O componente
  lê com `useSyncExternalStore(assinarPaginaDaAya, obterPaginaDaAya)`.
*/

import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import { esquecerConversa } from "../../modules/aya-memoria.js";
import {
  EVENTO_SECAO_ABERTA,
  secaoAtualDeConfiguracao,
} from "../configuracoes/secoes.ts";

const ouvintes = new Set();

const areaAtual = () => obterDadosDoMonitoramento().areaAtual || "";

let estado = Object.freeze({
  view: "",
  titulo: "",
  secao: "",
  area: areaAtual(),
  /** Sobe a cada conversa esquecida (saída): o painel limpa a que mostra. */
  conversa: 0,
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

/*
  A pessoa saiu (ou ficou sem acesso): a conversa guardada na aba sai, e o
  painel — que continua montado — limpa a que está na tela.
*/
export function esquecerConversaDaAya(janela = globalThis) {
  esquecerConversa(janela);
  publicar({ conversa: estado.conversa + 1 });
}

/** Só para os testes: volta ao estado inicial. */
export function redefinirPaginaDaAya() {
  estado = Object.freeze({
    view: "",
    titulo: "",
    secao: "",
    area: areaAtual(),
    conversa: 0,
  });
  for (const ouvinte of ouvintes) ouvinte();
}
