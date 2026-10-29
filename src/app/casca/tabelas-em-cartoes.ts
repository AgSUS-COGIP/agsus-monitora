import { useEffect } from "react";
import { LARGURA_DE_GAVETA } from "../../componentes/barra-lateral/usar-ambiente.ts";

/*
  No celular (até 900px, a mesma largura da gaveta), cada linha de tabela vira
  um cartão: o CSS (`src/styles/mobile-table-cards.css`) desenha o cartão e
  escreve o nome da coluna antes de cada valor, lido de `data-mobile-label`,
  que este módulo põe nas células.

  Fica de fora a tabela com `data-mobile-table="scroll"` (rola de lado) ou
  `"off"`, e as grades, o calendário, a linha do tempo e as matrizes.

  As telas desenham as tabelas a qualquer momento (React, carga sob demanda,
  filtro), então os rótulos são refeitos no quadro seguinte a cada clique,
  mudança de campo, `agsus:content-updated`, giro ou mudança de largura.
*/

const TABELAS = "table:not([data-mobile-table='scroll'])";
const EXCLUIDAS =
  "[role='grid'], .calendar, .timeline, .matrix, [data-mobile-table='off']";

export function normalizarCabecalho(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cabecalhosDaTabela(tabela: HTMLTableElement): string[] {
  return Array.from(tabela.querySelectorAll("thead th"), (celula, indice) => {
    /*
      Cabeçalho sem texto (a caixa "Selecionar as fichas da lista" da Fila):
      o nome acessível do controle, em vez de "Campo 1" no cartão.
    */
    const rotuloAcessivel =
      celula.getAttribute("aria-label") ||
      celula.querySelector("[aria-label]")?.getAttribute("aria-label") ||
      celula.getAttribute("title");
    return (
      normalizarCabecalho(celula.textContent) ||
      normalizarCabecalho(rotuloAcessivel) ||
      `Campo ${indice + 1}`
    );
  });
}

export function viraCartao(tabela: unknown): tabela is HTMLTableElement {
  if (!(tabela instanceof HTMLTableElement)) return false;
  if (tabela.matches(EXCLUIDAS)) return false;
  if (!tabela.tHead || !tabela.tBodies.length) return false;
  return cabecalhosDaTabela(tabela).length > 0;
}

/** Põe os rótulos nas células e marca a tabela como cartão. */
export function tabelaEmCartoes(tabela: unknown): boolean {
  if (!viraCartao(tabela)) return false;

  const cabecalhos = cabecalhosDaTabela(tabela);
  for (const linha of tabela.querySelectorAll("tbody tr")) {
    Array.from((linha as HTMLTableRowElement).cells).forEach(
      (celula, indice) => {
        celula.dataset.mobileLabel =
          cabecalhos[indice] || `Campo ${indice + 1}`;
      },
    );
  }

  tabela.classList.add("mobile-card-table");
  tabela.dataset.mobileEnhanced = "true";
  return true;
}

/** No celular, as tabelas de `raiz` viram cartões. Devolve quantas. */
export function tabelasDaTelaEmCartoes(raiz: ParentNode = document): number {
  if (window.innerWidth > LARGURA_DE_GAVETA) return 0;
  return Array.from(raiz.querySelectorAll(TABELAS)).filter(tabelaEmCartoes)
    .length;
}

export function usarTabelasEmCartoes() {
  useEffect(() => {
    let quadro = 0;
    const agendar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => tabelasDaTelaEmCartoes());
    };
    agendar();
    const doDocumento = ["click", "change", "agsus:content-updated"];
    const daJanela = ["resize", "orientationchange"];
    for (const nome of doDocumento) document.addEventListener(nome, agendar);
    for (const nome of daJanela)
      window.addEventListener(nome, agendar, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      for (const nome of doDocumento)
        document.removeEventListener(nome, agendar);
      for (const nome of daJanela) window.removeEventListener(nome, agendar);
    };
  }, []);
}
