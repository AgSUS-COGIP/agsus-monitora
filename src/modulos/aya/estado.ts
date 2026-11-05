/*
  Onde a pessoa está, para a Aya: a página aberta (view do legado e título do
  cabeçalho), a área atual do app e, em Configurações, a seção aberta.

  Sem React: `definirTitulo` da navegação (src/app/navegacao.ts) chama
  `definirPaginaDaAya` a cada navegação; a área vem de
  `dados-do-monitoramento.ts` (trocar de área no menu avisa aqui) e a seção,
  do evento que `configuracoes/secoes.ts` dispara ao abrir cada seção. O componente
  lê com `useSyncExternalStore(assinarPaginaDaAya, obterPaginaDaAya)`.
*/

import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import { esquecerConversa } from "../../modules/aya-memoria.ts";

/** Onde a pessoa está: view, título, seção, área e a conversa da vez. */
export interface PaginaAbertaDaAya {
  readonly view: string;
  readonly titulo: string;
  readonly secao: string;
  readonly area: string;
  /** Sobe a cada conversa esquecida (saída): o painel limpa a que mostra. */
  readonly conversa: number;
}

const ouvintes = new Set<() => void>();

const areaAtual = (): string => obterDadosDoMonitoramento().areaAtual || "";

let estado: PaginaAbertaDaAya = Object.freeze({
  view: "",
  titulo: "",
  secao: "",
  area: areaAtual(),
  /** Sobe a cada conversa esquecida (saída): o painel limpa a que mostra. */
  conversa: 0,
});

function publicar(mudancas: Partial<PaginaAbertaDaAya>): void {
  const proximo: PaginaAbertaDaAya = { ...estado, ...mudancas };
  if (
    (Object.keys(proximo) as (keyof PaginaAbertaDaAya)[]).every(
      (chave) => proximo[chave] === estado[chave],
    )
  )
    return;
  estado = Object.freeze(proximo);
  for (const ouvinte of ouvintes) ouvinte();
}

export const obterPaginaDaAya = (): PaginaAbertaDaAya => estado;

export function assinarPaginaDaAya(ouvinte: () => void): () => boolean {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * A navegação abriu uma página: a view (`dashboard`, `recursos`, `config`…),
 * o título do cabeçalho e, em Configurações, a seção aberta.
 */
export function definirPaginaDaAya(
  view: unknown,
  titulo: unknown = "",
  secao: unknown = "",
): void {
  const chave = String(view || "").trim();
  publicar({
    view: chave,
    titulo: String(titulo || "").trim(),
    secao: chave === "config" ? String(secao || "").trim() : "",
    area: areaAtual(),
  });
}

assinarDadosDoMonitoramento(() => publicar({ area: areaAtual() }));

/*
  A pessoa saiu (ou ficou sem acesso): a conversa guardada na aba sai, e o
  painel — que continua montado — limpa a que está na tela.
*/
export function esquecerConversaDaAya(
  janela: typeof globalThis = globalThis,
): void {
  esquecerConversa(janela);
  publicar({ conversa: estado.conversa + 1 });
}

/** Só para os testes: volta ao estado inicial. */
export function redefinirPaginaDaAya(): void {
  estado = Object.freeze({
    view: "",
    titulo: "",
    secao: "",
    area: areaAtual(),
    conversa: 0,
  });
  for (const ouvinte of ouvintes) ouvinte();
}
