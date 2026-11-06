/*
  O "MAPA DSEIs" DOS DSEIs, SEM LEAFLET

  O terceiro fundo do mapa nacional (ao lado de Mapa e Satélite): sem
  azulejos, só os 34 DSEIs chapados e numerados sobre um fundo liso, como o
  mapa institucional da AgSUS. Aqui ficam as regras: o que cada DSEI mostra
  (os mesmos números da lista "Territórios por vagas" — nenhuma consulta
  nova), as faixas da cor, a legenda e a dica.

  "Colorir por":
  - "% preenchidas" (padrão): cinco faixas fixas de 20 pontos;
  - "Vagas ociosas": cinco faixas por quantis dos valores do recorte;
  - "Cor do DSEI": uma cor categórica estável por número (1–34).

  Sem dado = o DSEI não está na lista do recorte ou não tem vaga: tom neutro
  e "sem dado" na legenda (nos indicadores; na cor do DSEI todos têm cor).

  As cores são tokens (`--mapa-simples-*`, src/styles/tokens.css), com valor
  claro e escuro; aqui só o nome do token.
*/
import type { DseiDoMapa, TerritorioDoMapa } from "./tipos.ts";
import { formatarNumero, plural } from "./chaves.ts";
import { DSEIS_OFICIAIS, numeroDoDsei } from "./dseis-oficiais.ts";

export type ColorirPor = "preenchidas" | "ociosas" | "dsei";

export const OPCOES_DE_COLORIR: readonly {
  valor: ColorirPor;
  rotulo: string;
}[] = Object.freeze([
  { valor: "preenchidas", rotulo: "% preenchidas" },
  { valor: "ociosas", rotulo: "Vagas ociosas" },
  { valor: "dsei", rotulo: "Cor do DSEI" },
]);

export const COLORIR_PADRAO: ColorirPor = "preenchidas";

export function colorirValido(valor: unknown): ColorirPor {
  return OPCOES_DE_COLORIR.some((o) => o.valor === valor)
    ? (valor as ColorirPor)
    : COLORIR_PADRAO;
}

/* Quantas classes tem a escala sequencial (e quantos tokens `--mapa-simples-seq-N`). */
export const CLASSES_DA_ESCALA = 5;

export interface FaixaDaEscala {
  classe: number;
  minimo: number;
  maximo: number;
  rotulo: string;
}

/* % preenchidas: 0–19, 20–39, 40–59, 60–79, 80–100. */
export function faixasDePreenchidas(): FaixaDaEscala[] {
  return Array.from({ length: CLASSES_DA_ESCALA }, (_, i) => {
    const minimo = i * 20;
    const maximo = i === CLASSES_DA_ESCALA - 1 ? 100 : minimo + 19;
    return { classe: i + 1, minimo, maximo, rotulo: `${minimo}–${maximo}%` };
  });
}

/*
  Vagas ociosas: os valores inteiros do recorte em até cinco faixas por
  quantis (20%, 40%…), sem faixa vazia nem repetida. Poucos valores
  distintos dão menos faixas; nenhum valor, nenhuma faixa.
*/
export function faixasDeOciosas(valores: readonly number[]): FaixaDaEscala[] {
  const ordenados = valores
    .filter((v) => Number.isFinite(v) && v >= 0)
    .map((v) => Math.round(v))
    .sort((a, b) => a - b);
  const menor = ordenados[0];
  if (menor === undefined) return [];
  const distintos = [...new Set(ordenados)];
  let tetos: number[];
  if (distintos.length <= CLASSES_DA_ESCALA) tetos = distintos;
  else {
    tetos = [];
    for (let i = 1; i <= CLASSES_DA_ESCALA; i += 1) {
      const posicao = Math.ceil((i / CLASSES_DA_ESCALA) * ordenados.length) - 1;
      const teto = ordenados[Math.min(posicao, ordenados.length - 1)] ?? menor;
      if (!tetos.includes(teto)) tetos.push(teto);
    }
  }
  let minimo = menor;
  return tetos.map((maximo, i) => {
    const faixa = {
      classe: i + 1,
      minimo,
      maximo,
      rotulo:
        minimo === maximo
          ? formatarNumero(minimo)
          : `${formatarNumero(minimo)}–${formatarNumero(maximo)}`,
    };
    minimo = maximo + 1;
    return faixa;
  });
}

/* A faixa do valor (pela posição na lista); `null` sem valor ou fora das faixas. */
export function faixaDoValor(
  valor: number | null | undefined,
  faixas: readonly FaixaDaEscala[],
): FaixaDaEscala | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor))
    return null;
  return faixas.find((f) => valor >= f.minimo && valor <= f.maximo) ?? null;
}

/*
  O token da classe: com menos de cinco faixas, elas se espalham pela escala
  inteira (duas faixas = a mais clara e a mais escura), para não ficarem
  todas no começo claro.
*/
export function tokenDaClasse(classe: number, total: number): string {
  const passo =
    total <= 1
      ? CLASSES_DA_ESCALA
      : 1 + Math.round(((classe - 1) * (CLASSES_DA_ESCALA - 1)) / (total - 1));
  return `--mapa-simples-seq-${passo}`;
}

export const TOKEN_SEM_DADO = "--mapa-simples-sem-dado";

/* A cor categórica do DSEI `numero` (1–34): `--mapa-simples-dsei-N`. */
export function tokenDoDsei(numero: number) {
  return `--mapa-simples-dsei-${numero}`;
}

/* O que cada um dos 34 DSEIs mostra: os números da lista do recorte. */
export interface IndicadorDoDsei {
  numero: number;
  nome: string;
  territorio: TerritorioDoMapa | null;
  vagas: number;
  ociosas: number;
  preenchidas: number | null;
  temDado: boolean;
}

export function indicadoresDosDseis(
  territorios: readonly TerritorioDoMapa[],
): IndicadorDoDsei[] {
  const porNumero = new Map<number, TerritorioDoMapa>();
  for (const t of territorios || []) {
    const numero = numeroDoDsei(t?.dsei?.k) ?? numeroDoDsei(t?.dsei?.n);
    if (numero && !porNumero.has(numero)) porNumero.set(numero, t);
  }
  return DSEIS_OFICIAIS.map((nome, i) => {
    const numero = i + 1;
    const territorio = porNumero.get(numero) ?? null;
    const vagas = territorio?.vagas ?? 0;
    const temDado = vagas > 0;
    return {
      numero,
      nome,
      territorio,
      vagas,
      ociosas: territorio?.ociosas ?? 0,
      preenchidas: temDado ? (territorio?.preenchidas ?? 0) : null,
      temDado,
    };
  });
}

/* O número do DSEI de um item do mapa (lmap) — o mesmo que a lista mostra. */
export function numeroDoDseiDoMapa(dsei: Pick<DseiDoMapa, "k" | "n">) {
  return numeroDoDsei(dsei?.k) ?? numeroDoDsei(dsei?.n);
}

export interface ItemDaLegendaSimples {
  token: string;
  rotulo: string;
  semDado?: boolean;
}

export interface PinturaDoMapaSimples {
  colorirPor: ColorirPor;
  /** O token de preenchimento de cada DSEI (número → token). */
  tokens: ReadonlyMap<number, string>;
  /** Faixas com amostra; "sem dado" por último, só se algum DSEI estiver sem. */
  legenda: ItemDaLegendaSimples[];
  titulo: string;
}

export function pintarDseis(
  indicadores: readonly IndicadorDoDsei[],
  colorirPor: ColorirPor,
): PinturaDoMapaSimples {
  const tokens = new Map<number, string>();
  if (colorirPor === "dsei") {
    for (const ind of indicadores)
      tokens.set(ind.numero, tokenDoDsei(ind.numero));
    return {
      colorirPor,
      tokens,
      legenda: [],
      titulo: "Cor do DSEI",
    };
  }
  const faixas =
    colorirPor === "preenchidas"
      ? faixasDePreenchidas()
      : faixasDeOciosas(
          indicadores.filter((i) => i.temDado).map((i) => i.ociosas),
        );
  let algumSemDado = false;
  for (const ind of indicadores) {
    const valor = colorirPor === "preenchidas" ? ind.preenchidas : ind.ociosas;
    const faixa = ind.temDado ? faixaDoValor(valor, faixas) : null;
    if (!faixa) algumSemDado = true;
    tokens.set(
      ind.numero,
      faixa ? tokenDaClasse(faixa.classe, faixas.length) : TOKEN_SEM_DADO,
    );
  }
  const legenda: ItemDaLegendaSimples[] = faixas.map((f) => ({
    token: tokenDaClasse(f.classe, faixas.length),
    rotulo: f.rotulo,
  }));
  if (algumSemDado)
    legenda.push({ token: TOKEN_SEM_DADO, rotulo: "sem dado", semDado: true });
  return {
    colorirPor,
    tokens,
    legenda,
    titulo: colorirPor === "preenchidas" ? "% preenchidas" : "Vagas ociosas",
  };
}

/* "N · Nome — X vagas, Y ociosas, Z% preenchidas" (ou "— sem dado"). */
export function dicaDoDseiSimples(ind: IndicadorDoDsei) {
  const cabeca = `${ind.numero} · ${ind.nome}`;
  if (!ind.temDado) return `${cabeca} — sem dado`;
  return `${cabeca} — ${plural(ind.vagas, "vaga", "vagas")}, ${plural(
    ind.ociosas,
    "ociosa",
    "ociosas",
  )}, ${ind.preenchidas}% preenchidas`;
}

/* Rótulo menor quando o Brasil inteiro está à vista. */
export const ZOOM_DO_ROTULO_PEQUENO = 5;
