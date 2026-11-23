/*
  OS INDICADORES DO MAPA PELO RECORTE ESCOLHIDO

  Os números do topo da aba Mapa seguem o seletor DSEI / CASAI, como no Mapa
  dos DSEIs do SIGEPSI: o Brasil inteiro, um DSEI ou uma CASAI nacional. Antes
  eram sempre os do Brasil, e escolher um DSEI não mudava nada no topo.

  - Brasil: DSEIs, CASAIs nacionais, pontos de unidades, editais, vagas e
    contratadas.
  - DSEI: população indígena, pontos de unidades, municípios (dos pontos do
    SIGEPSI), editais, vagas e contratadas do DSEI.
  - CASAI nacional: editais, vagas, contratadas e ociosas dela.

  Editais, vagas, contratadas e ociosas vêm da mesma contagem das bolhas
  (`contarPorDsei`): vaga reaberta descontada, cancelado sem vagas, ociosa só
  em edital com resultado. A barra "vagas preenchidas" é contratadas ÷ vagas.
*/
import type {
  CasaiNacionalDoMapa,
  ContagemDoDsei,
  DseiDoMapa,
} from "./tipos.ts";
import { chaveDoDsei, numero, texto } from "./chaves.ts";
import { chaveDosEditaisDaCasai } from "./mapa-nacional.ts";
import { percentualPreenchido } from "./contagem-por-dsei.ts";
import { registrosDoDsei, tiposDoTerritorio } from "./mapa-do-dsei.ts";

export interface IndicadorDoRecorte {
  chave: string;
  valor: number;
  rotulo: string;
}

export interface IndicadoresDoRecorte {
  /** "Brasil", o nome do DSEI ou o da CASAI. */
  titulo: string;
  indicadores: IndicadorDoRecorte[];
  vagas: number;
  contratadas: number;
  ociosas: number;
  /** Contratadas ÷ vagas, em % inteiro (0 sem vagas). */
  preenchidas: number;
}

const ZERO: Readonly<ContagemDoDsei> = Object.freeze({
  editais: 0,
  vagas: 0,
  contratadas: 0,
  ociosas: 0,
});

function somar(contagens: Iterable<ContagemDoDsei>): ContagemDoDsei {
  const total = { ...ZERO };
  for (const c of contagens) {
    total.editais += c.editais;
    total.vagas += c.vagas;
    total.contratadas += c.contratadas;
    total.ociosas += c.ociosas;
  }
  return total;
}

/** Municípios distintos dos pontos do DSEI (município + UF). */
export function municipiosDoDsei(dsei: DseiDoMapa): number {
  const vistos = new Set<string>();
  for (const p of dsei.polos || []) {
    const municipio = chaveDoDsei(texto(p.municipio));
    if (municipio) vistos.add(`${municipio}|${texto(p.uf)}`);
  }
  return vistos.size;
}

function comPreenchimento(
  titulo: string,
  indicadores: IndicadorDoRecorte[],
  c: ContagemDoDsei,
): IndicadoresDoRecorte {
  return {
    titulo,
    indicadores,
    vagas: c.vagas,
    contratadas: c.contratadas,
    ociosas: c.ociosas,
    preenchidas: percentualPreenchido(c),
  };
}

export function indicadoresDoRecorte({
  dseis = [],
  casais = [],
  contagens = new Map(),
  dsei = null,
  casai = null,
}: {
  dseis?: readonly DseiDoMapa[];
  casais?: readonly CasaiNacionalDoMapa[];
  contagens?: ReadonlyMap<string, ContagemDoDsei>;
  dsei?: DseiDoMapa | null;
  casai?: CasaiNacionalDoMapa | null;
} = {}): IndicadoresDoRecorte {
  if (dsei) {
    const c = contagens.get(chaveDoDsei(dsei.k)) || ZERO;
    return comPreenchimento(
      texto(dsei.n) || texto(dsei.k),
      [
        {
          chave: "populacao",
          valor: numero(dsei.pop),
          rotulo: "População indígena",
        },
        {
          chave: "unidades",
          valor: dsei.polos?.length ?? 0,
          rotulo: "Pontos de unidades",
        },
        {
          chave: "municipios",
          valor: municipiosDoDsei(dsei),
          rotulo: "Municípios",
        },
        { chave: "editais", valor: c.editais, rotulo: "Editais" },
        { chave: "vagas", valor: c.vagas, rotulo: "Vagas" },
        { chave: "contratadas", valor: c.contratadas, rotulo: "Contratadas" },
      ],
      c,
    );
  }
  if (casai) {
    const c = contagens.get(chaveDosEditaisDaCasai(casai, contagens)) || ZERO;
    return comPreenchimento(
      casai.nome,
      [
        { chave: "editais", valor: c.editais, rotulo: "Editais" },
        { chave: "vagas", valor: c.vagas, rotulo: "Vagas" },
        { chave: "contratadas", valor: c.contratadas, rotulo: "Contratadas" },
        { chave: "ociosas", valor: c.ociosas, rotulo: "Ociosas" },
      ],
      c,
    );
  }
  const c = somar(contagens.values());
  return comPreenchimento(
    "Brasil",
    [
      { chave: "dseis", valor: dseis.length, rotulo: "DSEIs mapeados" },
      { chave: "casais", valor: casais.length, rotulo: "CASAIs nacionais" },
      {
        chave: "unidades",
        valor: dseis.reduce((t, d) => t + (d.polos?.length ?? 0), 0),
        rotulo: "Pontos de unidades",
      },
      { chave: "editais", valor: c.editais, rotulo: "Editais acompanhados" },
      { chave: "vagas", valor: c.vagas, rotulo: "Vagas acompanhadas" },
      { chave: "contratadas", valor: c.contratadas, rotulo: "Contratadas" },
    ],
    c,
  );
}

/**
 * "Rede de saúde indígena por tipo" (como no SIGEPSI): os pontos do recorte
 * (sede, polo base, CASAI, UBSI, unidade), do mais frequente ao menos, e o
 * total. Conta o mesmo que o mapa desenha (`registrosDoDsei`).
 */
export function redePorTipo(dseis: readonly DseiDoMapa[]) {
  const registros = (dseis || []).flatMap((d) => registrosDoDsei(d));
  return { tipos: tiposDoTerritorio(registros), total: registros.length };
}
