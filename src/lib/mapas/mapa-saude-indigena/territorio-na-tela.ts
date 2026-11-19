/*
  O TERRITÓRIO, O ACESSO E O CNES NA TELA DO MAPA

  A resposta de `/api/territorio-dos-dseis` (território-do-sigepsi.ts) junto
  do que o mapa já desenha:

  - `respostaDoTerritorio`: confere a forma da resposta (o que não for fonte
    `{ ok }` vira fonte indisponível).
  - `situacaoDaFonte`: carregando, indisponível (com o motivo) ou pronta. A
    tela mostra "Dado do SIGEPSI indisponível" no lugar, nunca zero.
  - `territorioPorChaveDoMapa`: o território indexado pela chave do DSEI do
    mapa (`casarChaveDoDsei`: KAYAPO × KAIAPO etc.).
  - `unidadesComAcesso`: as unidades que o mapa desenha (`registrosDoDsei`),
    cada uma com o meio de acesso, a acessibilidade, urbano/rural, floresta
    (pelo `id` da localização, ou pelo nome) e o CNES (pelo nome).
  - `filtrarUnidades` e `cruzarComOciosas`: os filtros de meio de acesso e
    área de floresta, e os DSEIs com unidade no filtro ao lado das vagas
    ociosas deles (as contas de `contarPorDsei`).
  - `tabelaDasUnidades` e `tabelaDoCruzamento`: o retrato para exportar.
*/
import type { ContagemDoDsei, DseiDoMapa, RegistroDoDsei } from "./tipos.ts";
import { chaveDoDsei } from "./chaves.ts";
import type { TabelaParaExportar } from "../../base/exportacao-da-tabela.ts";
import {
  MEIOS_DE_ACESSO,
  NAO_INFORMADO,
  casarChaveDoDsei,
  chaveDoNomeDaUnidade,
  cnesDaUnidade,
} from "./territorio-do-sigepsi.ts";
import type {
  AcessoDaUnidade,
  EstabelecimentoDoCnes,
  FonteDoTerritorio,
  FonteLida,
  TerritorioDoDsei,
  TerritorioPorDsei,
} from "./territorio-do-sigepsi.ts";

export const TEXTO_DA_FONTE_INDISPONIVEL = "Dado do SIGEPSI indisponível";

export interface RespostaDoTerritorio {
  territorio: FonteLida<TerritorioPorDsei>;
  acesso: FonteLida<AcessoDaUnidade[]>;
  cnes: FonteLida<EstabelecimentoDoCnes[]>;
}

const objeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

const SEM_RESPOSTA = Object.freeze({
  ok: false,
  status: null,
  motivo: "resposta em formato inesperado",
}) as FonteLida<never>;

function fonte<T>(
  bruto: unknown,
  valida: (dados: unknown) => boolean,
): FonteLida<T> {
  if (!objeto(bruto)) return SEM_RESPOSTA;
  if (bruto.ok === true && valida(bruto.dados))
    return {
      ok: true,
      dados: bruto.dados as T,
      linhas: Number(bruto.linhas) || 0,
      campos: Array.isArray(bruto.campos) ? bruto.campos.map(String) : [],
    };
  if (bruto.ok === false)
    return {
      ok: false,
      status: typeof bruto.status === "number" ? bruto.status : null,
      motivo: String(bruto.motivo || "resposta em formato inesperado"),
    };
  return SEM_RESPOSTA;
}

export function respostaDoTerritorio(corpo: unknown): RespostaDoTerritorio {
  const c = objeto(corpo) ? corpo : {};
  return {
    territorio: fonte(c.territorio, objeto),
    acesso: fonte(c.acesso, Array.isArray),
    cnes: fonte(c.cnes, Array.isArray),
  };
}

export type SituacaoDaFonte<T> =
  | { tipo: "carregando" }
  | { tipo: "indisponivel"; motivo: string }
  | { tipo: "pronta"; dados: T };

/** `resposta` nula: ainda carregando; `falhou`: o pedido inteiro falhou. */
export function situacaoDaFonte<K extends FonteDoTerritorio>(
  resposta: RespostaDoTerritorio | null,
  qual: K,
  { falhou = false } = {},
): SituacaoDaFonte<
  RespostaDoTerritorio[K] extends FonteLida<infer T> ? T : never
> {
  if (falhou)
    return { tipo: "indisponivel", motivo: "o Yeendé não leu o SIGEPSI" };
  if (!resposta) return { tipo: "carregando" };
  const lida = resposta[qual];
  return lida.ok
    ? {
        tipo: "pronta",
        dados: lida.dados as RespostaDoTerritorio[K] extends FonteLida<infer T>
          ? T
          : never,
      }
    : { tipo: "indisponivel", motivo: lida.motivo };
}

/* ---------- território ---------- */

export function territorioPorChaveDoMapa(
  territorio: TerritorioPorDsei,
  chavesDoMapa: readonly string[],
): Map<string, TerritorioDoDsei> {
  const indice = new Map<string, TerritorioDoDsei>();
  for (const [chave, valor] of Object.entries(territorio)) {
    const doMapa = casarChaveDoDsei(chave, chavesDoMapa);
    if (doMapa && !indice.has(doMapa)) indice.set(doMapa, valor);
  }
  return indice;
}

/* ---------- unidades com acesso e CNES ---------- */

export interface UnidadeComAcesso {
  /** `nome|lat|lon`, a mesma unidade do mapa. */
  chave: string;
  nome: string;
  tipo: string;
  municipio: string;
  uf: string;
  /** `null`: a fonte não veio; `[]`: veio sem esta unidade. */
  meios: string[] | null;
  acessibilidade: string | null;
  localidade: string | null;
  floresta: string | null;
  cnes: string | null;
}

export const chaveDaUnidade = (
  r: Pick<RegistroDoDsei, "name" | "lat" | "lon">,
) => `${r.name}|${r.lat}|${r.lon}`;

/** Acesso e CNES de cada DSEI, pela chave do mapa. */
export function porDseiDoMapa<T extends { dsei: string }>(
  linhas: readonly T[] | null,
  chavesDoMapa: readonly string[],
): Map<string, T[]> | null {
  if (!linhas) return null;
  const casadas = new Map<string, string | null>();
  const indice = new Map<string, T[]>();
  for (const linha of linhas) {
    if (!casadas.has(linha.dsei))
      casadas.set(linha.dsei, casarChaveDoDsei(linha.dsei, chavesDoMapa));
    const doMapa = casadas.get(linha.dsei);
    if (!doMapa) continue;
    const lista = indice.get(doMapa) || [];
    lista.push(linha);
    indice.set(doMapa, lista);
  }
  return indice;
}

export function unidadesComAcesso({
  registros,
  acesso,
  cnes,
}: {
  registros: readonly RegistroDoDsei[];
  /** As do DSEI (`null`: fonte indisponível). */
  acesso: readonly AcessoDaUnidade[] | null;
  cnes: readonly EstabelecimentoDoCnes[] | null;
}): UnidadeComAcesso[] {
  const porId = new Map<string, AcessoDaUnidade>();
  const porNome = new Map<string, AcessoDaUnidade | null>();
  for (const a of acesso || []) {
    if (a.id) porId.set(a.id, a);
    const nome = chaveDoNomeDaUnidade(a.nome);
    // Dois com o mesmo nome no DSEI: o nome não decide.
    if (nome) porNome.set(nome, porNome.has(nome) ? null : a);
  }
  return registros.map((r) => {
    const a = acesso
      ? (r.cod ? porId.get(String(r.cod)) : undefined) ||
        porNome.get(chaveDoNomeDaUnidade(r.name)) ||
        null
      : null;
    // A lista do CNES já é a do DSEI; a grafia do DSEI é a da rota.
    const dsei = cnes?.[0]?.dsei ?? "";
    const doCnes = cnes ? cnesDaUnidade(r.name, dsei, cnes) : null;
    return {
      chave: chaveDaUnidade(r),
      nome: r.name,
      tipo: r.type?.label || "",
      municipio: r.city || "",
      uf: String(r.ufAdministrativa || r.uf || ""),
      meios: acesso ? (a?.meios ?? []) : null,
      acessibilidade: acesso ? (a?.acessibilidade ?? NAO_INFORMADO) : null,
      localidade: acesso ? (a?.localidade ?? NAO_INFORMADO) : null,
      floresta: acesso ? (a?.floresta ?? NAO_INFORMADO) : null,
      cnes: cnes ? (doCnes?.cnes ?? "") : null,
    };
  });
}

/* ---------- filtros ---------- */

export interface FiltroDeAcesso {
  /** "" = todos; um de MEIOS_DE_ACESSO ou "Não informado". */
  meio: string;
  /** "" = todas; "Sim" ou "Não". */
  floresta: string;
}

export const FILTRO_DE_ACESSO_VAZIO: Readonly<FiltroDeAcesso> = Object.freeze({
  meio: "",
  floresta: "",
});

export const OPCOES_DE_MEIO: readonly string[] = [
  ...MEIOS_DE_ACESSO,
  NAO_INFORMADO,
];
export const OPCOES_DE_FLORESTA: readonly string[] = ["Sim", "Não"];

export const filtroAtivo = (f: FiltroDeAcesso) => Boolean(f.meio || f.floresta);

export function atendeAoFiltro(
  u: UnidadeComAcesso,
  f: FiltroDeAcesso,
): boolean {
  if (f.meio) {
    const meios = u.meios?.length ? u.meios : [NAO_INFORMADO];
    if (!meios.includes(f.meio)) return false;
  }
  if (f.floresta && u.floresta !== f.floresta) return false;
  return true;
}

export const filtrarUnidades = (
  unidades: readonly UnidadeComAcesso[],
  f: FiltroDeAcesso,
) => unidades.filter((u) => atendeAoFiltro(u, f));

/** "Terrestre, Fluvial" ou "Não informado". */
export const textoDosMeios = (meios: readonly string[] | null) =>
  meios === null ? "" : meios.length ? meios.join(", ") : NAO_INFORMADO;

/* ---------- cruzamento com as vagas ociosas ---------- */

export interface LinhaDoCruzamento {
  k: string;
  nome: string;
  unidades: number;
  totalDeUnidades: number;
  vagas: number;
  ociosas: number;
}

export function cruzarComOciosas(
  porDsei: ReadonlyMap<
    string,
    { dsei: DseiDoMapa; unidades: readonly UnidadeComAcesso[] }
  >,
  contagens: ReadonlyMap<string, ContagemDoDsei>,
  f: FiltroDeAcesso,
): LinhaDoCruzamento[] {
  const linhas: LinhaDoCruzamento[] = [];
  for (const [k, { dsei, unidades }] of porDsei) {
    const noFiltro = filtrarUnidades(unidades, f).length;
    if (!noFiltro) continue;
    // As contagens usam a chave normalizada (`contarPorDsei`).
    const contagem = contagens.get(chaveDoDsei(k));
    linhas.push({
      k,
      nome: dsei.n,
      unidades: noFiltro,
      totalDeUnidades: unidades.length,
      vagas: contagem?.vagas ?? 0,
      ociosas: contagem?.ociosas ?? 0,
    });
  }
  return linhas.sort(
    (a, b) =>
      b.ociosas - a.ociosas ||
      b.unidades - a.unidades ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/* ---------- exportação ---------- */

const descricaoDoFiltro = (f: FiltroDeAcesso) =>
  [
    f.meio ? `acesso ${f.meio}` : "",
    f.floresta ? `floresta: ${f.floresta}` : "",
  ]
    .filter(Boolean)
    .join(", ");

export function tabelaDasUnidades(
  nomeDoDsei: string,
  unidades: readonly UnidadeComAcesso[],
  f: FiltroDeAcesso,
): TabelaParaExportar {
  const comAcesso = unidades.some((u) => u.meios !== null);
  const comCnes = unidades.some((u) => u.cnes !== null);
  const filtro = descricaoDoFiltro(f);
  return {
    titulo: [`Unidades do DSEI ${nomeDoDsei}`, filtro]
      .filter(Boolean)
      .join(" — "),
    colunas: [
      "Unidade",
      "Tipo",
      "Município",
      "UF",
      ...(comAcesso
        ? ["Meio de acesso", "Acessibilidade", "Urbano/rural", "Floresta"]
        : []),
      ...(comCnes ? ["CNES"] : []),
    ],
    linhas: unidades.map((u) => [
      u.nome,
      u.tipo,
      u.municipio,
      u.uf,
      ...(comAcesso
        ? [textoDosMeios(u.meios), u.acessibilidade, u.localidade, u.floresta]
        : []),
      ...(comCnes ? [u.cnes || ""] : []),
    ]),
  };
}

export function tabelaDoCruzamento(
  linhas: readonly LinhaDoCruzamento[],
  f: FiltroDeAcesso,
): TabelaParaExportar {
  const filtro = descricaoDoFiltro(f);
  return {
    titulo: ["Acesso das unidades e vagas ociosas", filtro]
      .filter(Boolean)
      .join(" — "),
    colunas: [
      "DSEI",
      "Unidades no filtro",
      "Unidades",
      "Vagas",
      "Vagas ociosas",
    ],
    linhas: linhas.map((l) => [
      l.nome,
      l.unidades,
      l.totalDeUnidades,
      l.vagas,
      l.ociosas,
    ]),
  };
}
