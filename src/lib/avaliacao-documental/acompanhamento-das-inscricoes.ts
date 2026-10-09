/*
  O acompanhamento das inscrições de um edital (cartão "Inscrições" da aba
  Pré-classificação), sem DOM: a janela das inscrições pelo cronograma, os
  totais do último retrato de cada vaga, a série diária (soma das vagas, o
  retrato de cada vaga vale até o próximo) e, por vaga, o "hoje +N" (inscritos
  do retrato de hoje menos os do último retrato de antes de hoje).

  Os retratos vêm de obter_acompanhamento_inscricoes
  (supabase/migrations/20261009140000_acompanhamento_das_inscricoes.sql),
  gravados pelo job da pré-classificação
  (python/monitora/avaliacao_documental/retrato_das_inscricoes.py), que só
  grava da véspera do início a 3 dias depois do fim: o cartão aparece na mesma
  janela (DIAS_DEPOIS_DO_FIM igual ao Python).
*/
import { janelaDasInscricoes } from "../classificacao/dados.js";

export const DIAS_DEPOIS_DO_FIM = 3;

export type Retrato = {
  vaga: string;
  data: string;
  inscritos: number;
  finalizados: number | null;
  aptos: number | null;
  eliminados: number | null;
  previa?: boolean;
  em?: string | null;
};
export type DadosDoAcompanhamento = {
  hoje?: string | null;
  cronograma?: {
    atividade?: string;
    inicio?: string | null;
    fim?: string | null;
  }[];
  vagas?: { codigo: string; cargo?: string | null }[];
  retratos?: Retrato[];
};
export type PontoDaSerie = {
  data: string;
  inscritos: number | null;
  aptos: number | null;
};
export type LinhaDaVaga = {
  codigo: string;
  cargo: string;
  inscritos: number | null;
  aptos: number | null;
  hoje: number | null;
};
export type Totais = {
  inscritos: number;
  finalizados: number | null;
  aptos: number | null;
  eliminados: number | null;
  hoje: number | null;
  previa: boolean;
  em: string | null;
};
export type Acompanhamento = {
  mostrar: boolean;
  inicio: string | null;
  fim: string | null;
  hoje: string | null;
  encerradas: boolean;
  totais: Totais | null;
  serie: PontoDaSerie[];
  vagas: LinhaDaVaga[];
};

const DIA = /^\d{4}-\d{2}-\d{2}/;
const dia = (valor: unknown): string | null =>
  typeof valor === "string" && DIA.test(valor) ? valor.slice(0, 10) : null;

/** "AAAA-MM-DD" somado de n dias (UTC, sem fuso). */
export function somarDias(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Os dias de inicio a fim, inclusive (até 120). */
export function diasEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let d = inicio; d <= fim && dias.length < 120; d = somarDias(d, 1))
    dias.push(d);
  return dias;
}

const soma = (valores: (number | null)[]): number | null =>
  valores.some((v) => typeof v === "number")
    ? valores.reduce<number>((t, v) => t + (typeof v === "number" ? v : 0), 0)
    : null;

/** O último retrato da vaga até o dia (inclusive), ou null. */
function ultimoAte(retratos: Retrato[], data: string): Retrato | null {
  let achado: Retrato | null = null;
  for (const r of retratos) if (r.data <= data) achado = r;
  return achado;
}

export function acompanhamentoDasInscricoes(
  dados: DadosDoAcompanhamento | null | undefined,
): Acompanhamento {
  const { inicio, fim } = janelaDasInscricoes(dados?.cronograma || []) as {
    inicio: string | null;
    fim: string | null;
  };
  const hoje = dia(dados?.hoje);
  const comeco = inicio || fim;
  const mostrar = Boolean(
    hoje &&
    comeco &&
    fim &&
    hoje >= somarDias(comeco, -1) &&
    hoje <= somarDias(fim, DIAS_DEPOIS_DO_FIM),
  );
  const vazio: Acompanhamento = {
    mostrar,
    inicio,
    fim,
    hoje,
    encerradas: Boolean(hoje && fim && hoje > fim),
    totais: null,
    serie: [],
    vagas: [],
  };
  if (!mostrar || !hoje || !comeco || !fim) return vazio;

  // Os retratos de cada vaga, em ordem de data (um por dia).
  const porVaga = new Map<string, Retrato[]>();
  for (const r of dados?.retratos || []) {
    const data = dia(r?.data);
    if (!data || !r?.vaga) continue;
    const lista = porVaga.get(r.vaga) || [];
    lista.push({ ...r, data });
    porVaga.set(r.vaga, lista);
  }
  for (const lista of porVaga.values())
    lista.sort((a, b) => a.data.localeCompare(b.data));

  const cargos = new Map(
    (dados?.vagas || []).map((v) => [v.codigo, v.cargo || ""]),
  );
  const codigos = [
    ...new Set([
      ...(dados?.vagas || []).map((v) => v.codigo),
      ...porVaga.keys(),
    ]),
  ].sort();

  const vagas: LinhaDaVaga[] = codigos.map((codigo) => {
    const lista = porVaga.get(codigo) || [];
    const ultimo = lista[lista.length - 1] || null;
    const antes = ultimoAte(lista, somarDias(hoje, -1));
    return {
      codigo,
      cargo: cargos.get(codigo) || "",
      inscritos: ultimo ? ultimo.inscritos : null,
      aptos: ultimo ? ultimo.aptos : null,
      hoje:
        ultimo && ultimo.data === hoje
          ? ultimo.inscritos - (antes ? antes.inscritos : 0)
          : null,
    };
  });

  const ultimos = codigos
    .map((c) => (porVaga.get(c) || []).at(-1))
    .filter((r): r is Retrato => Boolean(r));
  const totais: Totais | null = ultimos.length
    ? {
        inscritos: ultimos.reduce((t, r) => t + (r.inscritos || 0), 0),
        finalizados: soma(ultimos.map((r) => r.finalizados)),
        aptos: soma(ultimos.map((r) => r.aptos)),
        eliminados: soma(ultimos.map((r) => r.eliminados)),
        hoje: soma(vagas.map((v) => v.hoje)),
        previa: ultimos.some((r) => r.previa && r.aptos !== null),
        em:
          ultimos
            .map((r) => r.em || null)
            .filter(Boolean)
            .sort()
            .at(-1) || null,
      }
    : null;

  // A série: do início das inscrições ao fim (os dias depois de hoje ficam vazios).
  const serie: PontoDaSerie[] = diasEntre(comeco, fim).map((data) => {
    if (data > hoje) return { data, inscritos: null, aptos: null };
    const doDia = codigos
      .map((c) => ultimoAte(porVaga.get(c) || [], data))
      .filter((r): r is Retrato => Boolean(r));
    return {
      data,
      inscritos: doDia.length
        ? doDia.reduce((t, r) => t + r.inscritos, 0)
        : null,
      aptos: doDia.length ? soma(doDia.map((r) => r.aptos)) : null,
    };
  });

  return { ...vazio, totais, serie, vagas };
}

/** "+3", "0" ou "—". */
export function textoDoHoje(n: number | null): string {
  if (n === null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

/** "14/10" de "2026-10-14". */
export function diaEMes(data: string | null): string {
  return data ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : "";
}
