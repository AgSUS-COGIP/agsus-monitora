import type {
  ColunaDaTabela,
  LinhaDaVisaoGeral,
} from "../../modulos/visao-geral/tipos.ts";
import type {
  CelulaParaExportar,
  TabelaParaExportar,
} from "../base/exportacao-da-tabela.ts";
import { textoDaColuna } from "../paineis/relatorio-da-visao-geral.ts";
import { COLUNAS_DA_TABELA } from "./visao-geral.ts";

/*
  O "Exportar" da Visão geral (23/11/2026): a tabela de processos como está
  na tela — as linhas do recorte (filtros, busca e atalho) e as colunas à
  vista, na ordem da tela —, pelos dois botões de toda tabela (Excel e PDF,
  src/lib/base/exportacao-da-tabela.ts). O relatório com seções e modelos é o
  "Montar relatório" de Relatórios (src/lib/paineis/relatorio-da-visao-geral.ts),
  aberto pelo "Ver em Relatórios" com o mesmo recorte.

  As contagens simples saem como número (a planilha soma); o resto, com o
  texto da tela (textoDaColuna).
*/

const CONTAGENS = new Set<ColunaDaTabela>([
  "vagas_total",
  "inscritos",
  "aprovados",
  "cadastro_reserva",
]);

function celula(
  campo: ColunaDaTabela,
  linha: LinhaDaVisaoGeral,
): CelulaParaExportar {
  if (CONTAGENS.has(campo)) {
    const valor = linha[campo];
    if (valor === null || valor === undefined || valor === "") return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : textoDaColuna(campo, linha);
  }
  return textoDaColuna(campo, linha);
}

export function tabelaDaVisaoGeral(
  linhas: readonly LinhaDaVisaoGeral[],
  colunas: readonly ColunaDaTabela[],
  rotuloDaArea: string,
): TabelaParaExportar {
  const visiveis = COLUNAS_DA_TABELA.filter((c) => colunas.includes(c.campo));
  return {
    titulo: ["Visão geral", rotuloDaArea].filter(Boolean).join(" — "),
    colunas: visiveis.map((c) => c.rotulo),
    linhas: linhas.map((linha) => visiveis.map((c) => celula(c.campo, linha))),
  };
}
