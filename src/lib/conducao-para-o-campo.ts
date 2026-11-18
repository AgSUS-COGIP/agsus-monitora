/*
  O que a condução de entrevistas guarda no aparelho para abrir sem rede (a
  cópia automática de cada edital aberto e o "Levar para o campo",
  src/modulos/entrevistas/estado-da-conducao.ts). Só o necessário:

  - quem avalia numa banca leva só os convocados e os horários da sua banca
    (as bancas do `meu_perfil` entre os avaliadores ativos do edital); quem não
    tem banca no edital (coordenação) leva o edital inteiro;
  - o cálculo da convocação (`calculo`, a lista do motor da Classificação, com
    candidatos que não foram convocados) não vai: no campo, a fila basta.

  As RPCs da condução não mandam CPF nem contatos. A cópia vale 48 h
  (src/lib/cache-de-payload.ts).
*/

import { VALIDADE_DO_CACHE_MS } from "./cache-de-payload";

export const FORMATO_DA_COPIA_DA_CONDUCAO = 1;

/** Até quando a cópia guardada agora fica no aparelho: "19/11, 10:14". */
export function validadeDaCopia(agora: number, fuso?: string): string {
  const ate = new Date(agora + VALIDADE_DO_CACHE_MS);
  const dia = ate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: fuso,
  });
  const hora = ate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fuso,
  });
  return `${dia}, ${hora}`;
}

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** As bancas de quem está na tela no edital (vazio: sem banca). */
export function bancasDoPerfil(edital: unknown): Set<number> {
  const dados = registro(edital);
  const perfil = dados.meu_perfil;
  if (!perfil) return new Set();
  return new Set(
    lista(dados.avaliadores)
      .map(registro)
      .filter((a) => a.perfil === perfil && a.ativo !== false)
      .map((a) => Number(a.banca))
      .filter((b) => Number.isFinite(b)),
  );
}

/** As partes do edital aberto como vão para o aparelho. */
export function copiaParaOCampo({
  resposta,
  previsao,
  agenda,
}: {
  resposta: unknown;
  previsao: unknown;
  agenda: unknown;
}) {
  const bancas = bancasDoPerfil(resposta);
  const daBanca = (item: unknown) =>
    !bancas.size || bancas.has(Number(registro(item).banca));
  const dados = registro(resposta);
  return {
    formato: FORMATO_DA_COPIA_DA_CONDUCAO,
    resposta: bancas.size
      ? { ...dados, convocados: lista(dados.convocados).filter(daBanca) }
      : resposta,
    previsao,
    agenda:
      bancas.size && agenda
        ? {
            ...registro(agenda),
            itens: lista(registro(agenda).itens).filter(daBanca),
          }
        : agenda,
    calculo: null,
    /** Só a banca de quem avalia, ou o edital inteiro. */
    soDaBanca: bancas.size > 0,
  };
}
