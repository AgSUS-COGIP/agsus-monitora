import { situacaoDoSistema } from "../app/situacao-do-sistema.ts";
import { paginaDesligada } from "../lib/navegacao/pagina-desligada.ts";
import { abasDoMenu, catalogoDoBanco } from "../modules/catalogo-de-abas.ts";
import { usarAreaAtual } from "./usar-area-atual.ts";

/*
  A página (`view`) está ligada na área atual? Desligada pela coordenação
  (Configurações › Módulos e abas), ela some do menu; quem leva até ela (a
  Central de convocações, o atalho "Ver em Convocações") também a esconde.
*/
export function usarPaginaLigada(view: string): boolean {
  const { area } = usarAreaAtual();
  return !paginaDesligada({
    abas: abasDoMenu(),
    doBanco: catalogoDoBanco(),
    situacao: situacaoDoSistema(),
    view,
    area,
  });
}
