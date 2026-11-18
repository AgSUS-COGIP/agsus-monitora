/*
  A ABA MAPA (Saúde Indígena) E O CARTÃO DELA NA VISÃO GERAL

  - O DSEI aberto mora no endereço: `/saude-indigena/mapa/yanomami`. O pedaço
    é a chave do DSEI (`chaveDoDsei`) em minúsculas, com hífen no lugar do
    espaço; de volta, `chaveDoDsei` já trata o hífen como espaço.
  - O cartão da Visão geral resume o mapa em três números, pelas mesmas contas
    das bolhas (`contarPorDsei`): quantos dos 34 DSEIs têm edital, o que tem
    mais vagas ociosas e o menos preenchido (contratadas ÷ vagas).
*/
import type { LinhaDoMonitoramento } from "../../../componentes/tipos-do-monitoramento.ts";
import { chaveDoDsei, texto } from "./chaves.ts";
import { contarPorDsei } from "./contagem-por-dsei.ts";
import {
  DSEIS_OFICIAIS,
  nomeOficialDoDsei,
  numeroDoDsei,
} from "./dseis-oficiais.ts";

/** O pedaço do endereço do DSEI ("Alto Rio Negro" → "alto-rio-negro"). */
export function dseiNoEndereco(nomeOuChave: unknown): string {
  return chaveDoDsei(nomeOuChave)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A chave do DSEI do pedaço do endereço ("" se não houver). */
export function chaveDoDseiNoEndereco(pedaco: unknown): string {
  return chaveDoDsei(texto(pedaco));
}

export interface DestaqueDoMapa {
  nome: string;
  /** O pedaço do endereço, para abrir o DSEI no Mapa. */
  endereco: string;
  valor: number;
}

export interface ResumoDoMapa {
  /** DSEIs (dos 34) com algum edital nas linhas. */
  comEdital: number;
  total: number;
  /** O DSEI com mais vagas ociosas (nenhum com ociosa: `null`). */
  maisOciosas: DestaqueDoMapa | null;
  /** O DSEI com vaga e a menor parte preenchida, em % (nenhum com vaga: `null`). */
  menosPreenchido: DestaqueDoMapa | null;
}

const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR");

export function resumoDoMapa(
  linhas: readonly LinhaDoMonitoramento[],
): ResumoDoMapa {
  const dseis = [...contarPorDsei(linhas)]
    .map(([chave, contagem]) => {
      const numero = numeroDoDsei(chave);
      return numero
        ? {
            ...contagem,
            nome: nomeOficialDoDsei(numero) || chave,
            endereco: dseiNoEndereco(chave),
            preenchidas: contagem.vagas
              ? Math.round(
                  (Math.min(contagem.contratadas, contagem.vagas) /
                    contagem.vagas) *
                    100,
                )
              : 0,
          }
        : null;
    })
    .filter((d) => d !== null);

  const comOciosas = dseis
    .filter((d) => d.ociosas > 0)
    .sort((a, b) => b.ociosas - a.ociosas || porNome(a, b));
  const comVagas = dseis
    .filter((d) => d.vagas > 0)
    .sort((a, b) => a.preenchidas - b.preenchidas || porNome(a, b));
  const ociosas = comOciosas[0];
  const menos = comVagas[0];
  return {
    comEdital: dseis.filter((d) => d.editais > 0).length,
    total: DSEIS_OFICIAIS.length,
    maisOciosas: ociosas
      ? {
          nome: ociosas.nome,
          endereco: ociosas.endereco,
          valor: ociosas.ociosas,
        }
      : null,
    menosPreenchido: menos
      ? { nome: menos.nome, endereco: menos.endereco, valor: menos.preenchidas }
      : null,
  };
}
