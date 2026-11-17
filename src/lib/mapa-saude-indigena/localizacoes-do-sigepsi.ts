import { chaveDoDsei, temCoordenada, texto } from "./chaves.js";

/*
  AS LOCALIZAÇÕES DO SIGEPSI (sede, polos base, CASAIs e unidades de lotação)

  A API do SIGEPSI (`/api/mapa-dseis/localizacoes/todas`, lida pela função
  `api/dseis.ts` com o token do servidor) é a FONTE VERDADEIRA da lista de
  DSEIs e dos pontos de cada um. Ela traz uma linha por unidade, com o DSEI
  pelo NOME (`NO_DSEI`); população e UFs do DSEI vêm do `lmap` do banco.

  - `localizacoesPorDsei(linhas)`: a resposta da API →
    `{ chave do DSEI: { nome, polos, sede } }`, só as ativas
    (`ST_REGISTRO_ATIVO = "S"`); pontos só com coordenada. A chave é
    `chaveDoDsei(NO_DSEI)`, a mesma que casa o `lmap` com os editais.
  - `aplicarLocalizacoes(lmap, porDsei)`: a lista de DSEIs passa a ser a do
    SIGEPSI, com polos e sede (posição, município e UF) dele.

  Os pontos de cada DSEI e as CASAIs são só os daqui (o CNES saiu do mapa em
  17/11/2026); corrigir um ponto é no SIGEPSI.
*/

export const ORIGEM_SIGEPSI = "sigepsi" as const;

/*
  As CASAIs de referência nacional no SIGEPSI, pelo código da localização
  (`CO_SEQ_LOCALIZACAO_POLO_BASE`): 131 = CASAI DF (Brasília), 132 = CASAI
  São Paulo. Viram o losango do mapa nacional, não ponto de um DSEI.
*/
export const CODIGOS_DAS_CASAIS_NACIONAIS: ReadonlySet<string> = new Set([
  "131",
  "132",
]);

const ehCasaiNacional = (linha: Record<string, unknown>) =>
  CODIGOS_DAS_CASAIS_NACIONAIS.has(texto(linha.CO_SEQ_LOCALIZACAO_POLO_BASE));

/* `unidade`: unidade de lotação (UBSI, posto, aldeia) — une com o mesmo
   lugar do CNES que não seja polo nem CASAI. */
export type TipoDoSigepsi = "casai" | "polo" | "unidade";

/*
  Um polo no formato do `lmap` (cabe no `PoloDoMapa` de tipos.ts, que não se
  importa aqui: ele puxa componentes do mapa, e a função da Vercel usa este
  arquivo).
*/
export interface PoloDoSigepsi {
  n: string;
  lat: number;
  lon: number;
  uf: string;
  cod: string | null;
  tipo: TipoDoSigepsi;
  municipio: string;
  origem: typeof ORIGEM_SIGEPSI;
}

export interface SedeDoSigepsi {
  lat: number;
  lon: number;
  uf: string;
  municipio: string;
}

export interface LocalizacoesDoDsei {
  /** `NO_DSEI` como veio (o nome do DSEI que só existe no SIGEPSI). */
  nome: string;
  polos: PoloDoSigepsi[];
  sede: SedeDoSigepsi | null;
}

export type LocalizacoesPorDsei = Record<string, LocalizacoesDoDsei>;

/*
  UF pelo CEP (faixas dos Correios). A API não traz a UF, e é ela que diz se a
  unidade fica fora do território do DSEI (vínculo externo).
*/
const FAIXAS_DO_CEP: readonly [number, number, string][] = [
  [1000, 19999, "SP"],
  [20000, 28999, "RJ"],
  [29000, 29999, "ES"],
  [30000, 39999, "MG"],
  [40000, 48999, "BA"],
  [49000, 49999, "SE"],
  [50000, 56999, "PE"],
  [57000, 57999, "AL"],
  [58000, 58999, "PB"],
  [59000, 59999, "RN"],
  [60000, 63999, "CE"],
  [64000, 64999, "PI"],
  [65000, 65999, "MA"],
  [66000, 68899, "PA"],
  [68900, 68999, "AP"],
  [69000, 69299, "AM"],
  [69300, 69399, "RR"],
  [69400, 69899, "AM"],
  [69900, 69999, "AC"],
  [70000, 72799, "DF"],
  [72800, 72999, "GO"],
  [73000, 73699, "DF"],
  [73700, 76799, "GO"],
  [76800, 76999, "RO"],
  [77000, 77999, "TO"],
  [78000, 78899, "MT"],
  [79000, 79999, "MS"],
  [80000, 87999, "PR"],
  [88000, 89999, "SC"],
  [90000, 99999, "RS"],
];

export function ufDoCep(cep: unknown): string {
  const digitos = texto(cep).replace(/\D/g, "");
  if (digitos.length !== 8) return "";
  const prefixo = Number(digitos.slice(0, 5));
  const faixa = FAIXAS_DO_CEP.find(
    ([de, ate]) => prefixo >= de && prefixo <= ate,
  );
  return faixa ? faixa[2] : "";
}

const semAcento = (valor: unknown) =>
  texto(valor).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/*
  TP_UNIDADE → o tipo do ponto, ou `null` para o que não entra no mapa. A API
  traz (17/11/2026): POLO BASE, ROTA (rotas de polo base, ex.: "PB ALTAMIRA
  (ROTA DO BAGAJÁ)"), CASAI, SEDE e UNIDADE DE LOTAÇÃO. A unidade de lotação
  que se declara polo ou CASAI pelo nome conta como tal.
*/
export function tipoDaLocalizacao(
  tipo: unknown,
  nome: unknown = "",
): TipoDoSigepsi | "sede" | null {
  const t = semAcento(tipo);
  if (/\bCASAI\b/.test(t)) return "casai";
  if (/\bPOLO\b|\bROTA\b/.test(t)) return "polo";
  if (/\bSEDE\b/.test(t)) return "sede";
  if (/\bLOTACAO\b/.test(t)) {
    const n = semAcento(nome);
    if (/\bCASAI\b|CASA DE SAUDE/.test(n)) return "casai";
    if (/\bPOLO\b|^\s*PB\b/.test(n)) return "polo";
    return "unidade";
  }
  return null;
}

const registro = (valor: unknown): Record<string, unknown> | null =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;

export function localizacoesPorDsei(linhas: unknown): LocalizacoesPorDsei {
  const porDsei: LocalizacoesPorDsei = {};
  if (!Array.isArray(linhas)) return porDsei;
  for (const valor of linhas) {
    const linha = registro(valor);
    if (!linha) continue;
    if (texto(linha.ST_REGISTRO_ATIVO).toUpperCase() !== "S") continue;
    const nomeDoDsei = texto(linha.NO_DSEI);
    // CASAI nacional (131, 132): vai para o mapa nacional, não é ponto de DSEI.
    if (ehCasaiNacional(linha)) continue;
    // O NO_DSEI delas é o próprio nome ("CASAI DF"): também não vira distrito.
    if (/^CASAI\b/.test(semAcento(nomeDoDsei))) continue;
    const chave = chaveDoDsei(nomeDoDsei);
    if (!chave) continue;
    // O DSEI existe mesmo que nenhum ponto dele tenha coordenada.
    const doDsei = (porDsei[chave] ||= {
      nome: nomeDoDsei,
      polos: [],
      sede: null,
    });
    const nome = texto(linha.NO_LOTACAO);
    const lat = texto(linha.CG_LATITUDE);
    const lon = texto(linha.CG_LONGITUDE);
    const tipo = tipoDaLocalizacao(linha.TP_UNIDADE, nome);
    if (!tipo || !nome || !temCoordenada(lat, lon)) continue;
    const latitude = Number(lat);
    const longitude = Number(lon);
    // 0,0 é o "sem coordenada" de muitos cadastros, não um ponto no Brasil.
    if (latitude === 0 && longitude === 0) continue;
    const uf = ufDoCep(linha.NU_CEP);
    const municipio = texto(linha.NO_MUNICIPIO);
    if (tipo === "sede") {
      // Uma sede por DSEI: vale a primeira.
      doDsei.sede ||= { lat: latitude, lon: longitude, uf, municipio };
      continue;
    }
    doDsei.polos.push({
      n: nome,
      lat: latitude,
      lon: longitude,
      uf,
      cod: texto(linha.CO_SEQ_LOCALIZACAO_POLO_BASE) || null,
      tipo,
      municipio,
      origem: ORIGEM_SIGEPSI,
    });
  }
  return porDsei;
}

/*
  AS CASAIs VÊM SÓ DO SIGEPSI

  As de cada DSEI já entram como polos `tipo: "casai"`. As nacionais
  (CODIGOS_DAS_CASAIS_NACIONAIS: 131 CASAI DF, 132 CASAI São Paulo) viram a
  lista do mapa nacional ([nome, código, lat, lon, município, UF]). Sem CEP (CASAI DF), a UF é a
  sigla do nome do DSEI ("CASAI DF" → DF).
*/
export type CasaiNacionalDoSigepsi = [
  nome: string,
  codigo: string | null,
  lat: number,
  lon: number,
  municipio: string,
  uf: string,
];

export function casaisNacionaisDoSigepsi(
  linhas: unknown,
): CasaiNacionalDoSigepsi[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.flatMap((valor): CasaiNacionalDoSigepsi[] => {
    const linha = registro(valor);
    if (!linha || texto(linha.ST_REGISTRO_ATIVO).toUpperCase() !== "S")
      return [];
    if (!ehCasaiNacional(linha)) return [];
    const nome = texto(linha.NO_LOTACAO) || texto(linha.NO_DSEI);
    const lat = texto(linha.CG_LATITUDE);
    const lon = texto(linha.CG_LONGITUDE);
    if (!temCoordenada(lat, lon)) return [];
    if (Number(lat) === 0 && Number(lon) === 0) return [];
    const sigla = chaveDoDsei(linha.NO_DSEI);
    const uf = ufDoCep(linha.NU_CEP) || (/^[A-Z]{2}$/.test(sigla) ? sigla : "");
    return [
      [
        nome,
        texto(linha.CO_SEQ_LOCALIZACAO_POLO_BASE) || null,
        Number(lat),
        Number(lon),
        texto(linha.NO_MUNICIPIO),
        uf,
      ],
    ];
  });
}

const MINUSCULAS = new Set(["e", "de", "do", "da", "dos", "das"]);

/* "MÉDIO RIO SOLIMÕES E AFLUENTES" → "Médio Rio Solimões e Afluentes". */
export function nomeLegivel(nome: unknown): string {
  return texto(nome)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, i) =>
      i > 0 && MINUSCULAS.has(palavra)
        ? palavra
        : palavra.charAt(0).toUpperCase() + palavra.slice(1),
    )
    .join(" ");
}

/*
  OS DSEIs DO MAPA SÃO OS DO SIGEPSI, sem plano B no banco: se o SIGEPSI não
  responde, a tela mostra o erro (um dado desatualizado seria pior).

  Do `lmap` do banco, o DSEI de mesma chave empresta só o que a API não traz:
  o nome bem grafado, a população (tamanho da bolha) e as UFs administrativas
  (vínculo externo). DSEI só do banco não entra; DSEI só do SIGEPSI entra com
  o nome dele e a UF da sede. Sede (posição, município, UF) e pontos são os do
  SIGEPSI; DSEI sem sede no SIGEPSI fica sem bolha.
*/
export function aplicarLocalizacoes(
  lmap: unknown,
  porDsei: LocalizacoesPorDsei,
): { dsei: Record<string, unknown>[] } {
  const base = registro(lmap) || {};
  const doBanco = new Map<string, Record<string, unknown>>();
  for (const valor of Array.isArray(base.dsei)
    ? (base.dsei as unknown[])
    : []) {
    const dsei = registro(valor);
    if (dsei) doBanco.set(chaveDoDsei(dsei.k), dsei);
  }
  return {
    dsei: Object.values(porDsei).map((doDsei) => {
      const banco = doBanco.get(chaveDoDsei(doDsei.nome));
      const { sede } = doDsei;
      const ufDaSede = sede?.uf || "";
      const ufs = Array.isArray(banco?.ufs)
        ? banco.ufs
        : ufDaSede
          ? [ufDaSede]
          : [];
      return {
        k: doDsei.nome,
        n: typeof banco?.n === "string" ? banco.n : nomeLegivel(doDsei.nome),
        ...(banco && "pop" in banco ? { pop: banco.pop } : {}),
        ufs,
        sedeuf: (typeof banco?.sedeuf === "string" && banco.sedeuf) || ufDaSede,
        polos: doDsei.polos,
        ...(sede
          ? {
              lat: sede.lat,
              lon: sede.lon,
              sede_municipio: sede.municipio,
              sede_uf: sede.uf,
            }
          : {}),
      };
    }),
  };
}
