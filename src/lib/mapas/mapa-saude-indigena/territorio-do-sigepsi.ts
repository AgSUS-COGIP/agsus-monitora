import { chaveDoDsei, temCoordenada, texto } from "./chaves.js";

/*
  TERRITÓRIO, ACESSO E CNES DO SIGEPSI

  Formato nosso, só com o que o mapa usa (campos conferidos no código público
  da página do SIGEPSI, /js/mapa-dseis.js e /js/mapa-dseis-regras.js, e no
  teste das rotas com a chave do Yeendé, 19/11/2026):

  - Acesso de cada unidade (meio de acesso composto, "Terrestre/Fluvial";
    acessibilidade geográfica; urbano/rural; floresta): as colunas
    TP_MEIO_ACESSO, TP_ACESSIBILIDADE_GEOGRAFICA, TP_CATEGORIA_LOCALIDADE e
    ST_FLORESTA da `/localizacoes/todas`, que `api/dseis.ts` já lê
    (`localizacoesPorDsei`). As regras de leitura moram aqui.
  - A função `api/territorio-dos-dseis.ts` lê duas rotas que hoje só aceitam
    sessão de usuário do SIGEPSI (401 com o token, 19/11/2026); fica pronta
    para quando a chave for liberada:
    - `/api/mapa-dseis/territorio` (SIASI) → `territorioPorDsei`: população
      indígena, aldeias e terras indígenas de cada DSEI. Terras contam por
      `codigo` distinto (a mesma terra atravessa dois DSEIs; somar o
      `qtdTerrasIndigenas` contaria em dobro no total).
    - `/api/mapa-dseis/rede` (CNES) → `estabelecimentosDoCnes`: nome, CNES,
      UF, município e posição. O SIGEPSI não liga o CNES à localização por
      chave: casa pelo nome (`chaveDoNomeDaUnidade`).

  Nunca a `/api/mapa-dseis` (a força de trabalho pessoa a pessoa): a função
  só repassa território e unidade, e só os campos listados aqui.
*/

export const ROTAS_DO_TERRITORIO = Object.freeze({
  territorio: "/api/mapa-dseis/territorio",
  cnes: "/api/mapa-dseis/rede",
});
export type FonteDoTerritorio = keyof typeof ROTAS_DO_TERRITORIO;

export const NAO_INFORMADO = "Não informado";
export const MEIOS_DE_ACESSO = ["Terrestre", "Fluvial", "Aéreo"] as const;
export const ACESSIBILIDADES = [
  "Muito acessível",
  "Acessível",
  "Remoto",
  "Muito remoto",
] as const;

/* ---------- a resposta da função, por fonte ---------- */

export type FonteLida<T> =
  | { ok: true; dados: T; linhas: number; campos: string[] }
  | { ok: false; status: number | null; motivo: string };

/** O porquê de uma fonte negada, para a pessoa pedir a liberação certa. */
export function motivoDaFalha(status: number | null): string {
  if (status === 401 || status === 403)
    return "a chave do Yeendé não lê esta rota";
  if (status === 404) return "a rota não existe no SIGEPSI";
  if (status === null) return "o SIGEPSI não respondeu";
  return `o SIGEPSI respondeu ${status}`;
}

/*
  Os nomes dos campos das primeiras linhas (nunca os valores): o diagnóstico
  diz se a rota mudou de formato sem mostrar dado nenhum.
*/
export function camposDasLinhas(
  linhas: readonly unknown[],
  ate = 20,
): string[] {
  const campos = new Set<string>();
  for (const linha of linhas.slice(0, ate))
    if (linha && typeof linha === "object" && !Array.isArray(linha))
      Object.keys(linha).forEach((campo) => campos.add(campo));
  return [...campos].sort();
}

/* ---------- território ---------- */

export interface TerraDoTerritorio {
  codigo: string;
  nome: string;
}

export interface TerritorioDoDsei {
  /** O nome do DSEI como veio do SIGEPSI. */
  nome: string;
  populacao: number | null;
  aldeias: number | null;
  /** Terras distintas (por código) do DSEI; `null` se a rota não trouxe. */
  terras: number | null;
  listaDeTerras: TerraDoTerritorio[];
}

export type TerritorioPorDsei = Record<string, TerritorioDoDsei>;

const numeroOuNulo = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const objeto = (valor: unknown): Record<string, unknown> | null =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;

function terrasDaLinha(bruto: unknown): TerraDoTerritorio[] | null {
  if (!Array.isArray(bruto)) return null;
  const porCodigo = new Map<string, TerraDoTerritorio>();
  for (const item of bruto) {
    const terra = objeto(item);
    if (!terra) continue;
    const nome = texto(terra.nome);
    const codigo = texto(terra.codigo) || nome;
    if (codigo && !porCodigo.has(codigo))
      porCodigo.set(codigo, { codigo, nome });
  }
  return [...porCodigo.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export function territorioPorDsei(
  linhas: readonly unknown[],
): TerritorioPorDsei {
  const saida: TerritorioPorDsei = {};
  for (const item of linhas) {
    const linha = objeto(item);
    const chave = chaveDoDsei(linha?.dsei);
    if (!linha || !chave) continue;
    const lista = terrasDaLinha(linha.terras);
    saida[chave] = {
      nome: texto(linha.dsei),
      populacao: numeroOuNulo(linha.populacaoIndigena),
      aldeias: numeroOuNulo(linha.qtdAldeias),
      // Sem a lista, o número que a rota der (às vezes `terras` vem número).
      terras: lista
        ? lista.length
        : numeroOuNulo(linha.qtdTerrasIndigenas ?? linha.terras),
      listaDeTerras: lista ?? [],
    };
  }
  return saida;
}

/** Terras distintas de vários DSEIs (a que atravessa dois conta uma vez). */
export function terrasDistintas(
  territorios: readonly TerritorioDoDsei[],
): number {
  const codigos = new Set<string>();
  for (const t of territorios)
    for (const terra of t.listaDeTerras) codigos.add(terra.codigo);
  return codigos.size;
}

/* ---------- acesso das unidades ---------- */

export interface AcessoDaUnidade {
  /** Os meios, separados ("Terrestre/Fluvial" → os dois); vazio vira "Não informado". */
  meios: string[];
  acessibilidade: string;
  localidade: "Urbano" | "Rural" | typeof NAO_INFORMADO;
  floresta: "Sim" | "Não" | typeof NAO_INFORMADO;
}

const primeiraMaiuscula = (valor: string) =>
  valor ? valor[0]!.toUpperCase() + valor.slice(1) : valor;

/* "Aereo" e "AÉREO" são o mesmo "Aéreo". */
const MEIO_PELA_CHAVE: Record<string, string> = Object.fromEntries(
  MEIOS_DE_ACESSO.map((meio) => [
    meio.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    meio,
  ]),
);

/** Como o SIGEPSI: separa em "/", ",", ";", "+" e " e ". */
export function meiosDeAcesso(valor: unknown): string[] {
  const meios: string[] = [];
  for (const parte of texto(valor).split(/\s*[/,;+]\s*|\s+e\s+/i)) {
    const limpo = parte.trim().toLowerCase();
    if (!limpo) continue;
    const chave = limpo.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const meio = MEIO_PELA_CHAVE[chave] ?? primeiraMaiuscula(limpo);
    if (!meios.includes(meio)) meios.push(meio);
  }
  return meios.length ? meios : [NAO_INFORMADO];
}

const semAcento = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function acessibilidade(valor: unknown): string {
  const limpo = texto(valor);
  if (!limpo) return NAO_INFORMADO;
  const chave = semAcento(limpo);
  return ACESSIBILIDADES.find((a) => semAcento(a) === chave) ?? limpo;
}

export function localidade(valor: unknown): AcessoDaUnidade["localidade"] {
  const chave = semAcento(texto(valor));
  return chave === "urbano" || chave === "urbana"
    ? "Urbano"
    : chave === "rural"
      ? "Rural"
      : NAO_INFORMADO;
}

/** "S"/"Sim" e "N"/"Não" (qualquer caixa e acento). */
export function floresta(valor: unknown): AcessoDaUnidade["floresta"] {
  const chave = semAcento(texto(valor));
  return chave === "s" || chave === "sim"
    ? "Sim"
    : chave === "n" || chave === "nao"
      ? "Não"
      : NAO_INFORMADO;
}

const coordenada = (lat: unknown, lng: unknown) =>
  temCoordenada(lat, lng)
    ? { lat: Number(lat), lon: Number(lng) }
    : { lat: null, lon: null };

/* ---------- CNES ---------- */

export interface EstabelecimentoDoCnes {
  dsei: string;
  nome: string;
  cnes: string;
  uf: string;
  municipio: string;
  lat: number | null;
  lon: number | null;
}

export function estabelecimentosDoCnes(
  linhas: readonly unknown[],
): EstabelecimentoDoCnes[] {
  const saida: EstabelecimentoDoCnes[] = [];
  for (const item of linhas) {
    const linha = objeto(item);
    const dsei = chaveDoDsei(linha?.dsei);
    const cnes = texto(linha?.cnes);
    if (!linha || !dsei || !cnes) continue;
    saida.push({
      dsei,
      nome: texto(linha.nome),
      cnes,
      uf: texto(linha.uf).toUpperCase(),
      municipio: texto(linha.municipio),
      ...coordenada(linha.lat, linha.lng),
    });
  }
  return saida;
}

/*
  O nome da unidade sem o que muda entre o SIGEPSI e o CNES: acento, caixa,
  pontuação e as palavras do tipo ("Polo Base", "UBSI", "Unidade Básica de
  Saúde Indígena", "CASAI", "Aldeia"). "POLO BASE XITEI" e "Polo Base
  Indígena Xitei" ficam "XITEI".
*/
export function chaveDoNomeDaUnidade(nome: unknown): string {
  return texto(nome)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(
      /\b(UNIDADE BASICA DE SAUDE INDIGENA|UNIDADE BASICA DE SAUDE|POLO BASE|POSTO DE SAUDE|UBSI|UBS|CASAI|POLO|INDIGENA|ALDEIA|DSEI)\b/g,
      " ",
    )
    .replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** O CNES de uma unidade do DSEI, pelo nome; dois candidatos = nenhum. */
export function cnesDaUnidade(
  nome: string,
  dsei: string,
  estabelecimentos: readonly EstabelecimentoDoCnes[],
): EstabelecimentoDoCnes | null {
  const chave = chaveDoNomeDaUnidade(nome);
  if (!chave) return null;
  const achados = estabelecimentos.filter(
    (e) => e.dsei === dsei && chaveDoNomeDaUnidade(e.nome) === chave,
  );
  return new Set(achados.map((e) => e.cnes)).size === 1 ? achados[0]! : null;
}

/*
  A chave de um DSEI do SIGEPSI entre as do mapa: igual; ou igual trocando Y
  por I (KAYAPO × KAIAPO); ou a maior que contém a outra.
*/
export function casarChaveDoDsei(
  chave: string,
  doMapa: readonly string[],
): string | null {
  if (!chave) return null;
  if (doMapa.includes(chave)) return chave;
  const semY = (k: string) => k.replace(/Y/g, "I");
  const igual = doMapa.find((k) => semY(k) === semY(chave));
  if (igual) return igual;
  const contidas = doMapa
    .filter((k) => k.includes(chave) || chave.includes(k))
    .sort((a, b) => b.length - a.length);
  return contidas[0] ?? null;
}
