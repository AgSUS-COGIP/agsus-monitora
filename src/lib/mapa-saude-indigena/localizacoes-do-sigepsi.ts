import { chaveDoDsei, temCoordenada, texto } from "./chaves.js";

/*
  AS LOCALIZAÇÕES DO SIGEPSI (sede, polos base, CASAIs e unidades de lotação)

  A API do SIGEPSI (`/api/mapa-dseis/localizacoes/todas`, lida pela função
  `api/dseis.ts` com o token do servidor) é a FONTE VERDADEIRA dos pontos de
  cada DSEI. Ela traz uma linha por unidade, com o DSEI pelo NOME
  (`NO_DSEI`); centro das UFs, população e UFs do DSEI continuam do `lmap`.

  - `localizacoesPorDsei(linhas)`: a resposta da API →
    `{ chave do DSEI: { polos, sede } }`, só as ativas
    (`ST_REGISTRO_ATIVO = "S"`) e com coordenada. A chave é
    `chaveDoDsei(NO_DSEI)`, a mesma que casa o `lmap` com os editais.
  - `aplicarLocalizacoes(lmap, porDsei)`: nos DSEIs que a API traz, troca os
    `polos` e põe a sede (posição, município e UF) na do SIGEPSI; o DSEI que
    ela não traz fica como está no banco.

  Ponto repetido entre o SIGEPSI e o CNES (`rede_cnes`) vira um só, com nome,
  posição, município e UF do SIGEPSI (`registrosDoDsei`, mapa-do-dsei.ts).
  Tudo o que vem daqui tem `origem: "sigepsi"`: o editor de coordenadas não
  oferece (a correção é no SIGEPSI, não no banco do MONITORA).
*/

export const ORIGEM_SIGEPSI = "sigepsi" as const;

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
    const chave = chaveDoDsei(linha.NO_DSEI);
    const nome = texto(linha.NO_LOTACAO);
    const lat = texto(linha.CG_LATITUDE);
    const lon = texto(linha.CG_LONGITUDE);
    const tipo = tipoDaLocalizacao(linha.TP_UNIDADE, nome);
    if (!tipo || !chave || !nome || !temCoordenada(lat, lon)) continue;
    const latitude = Number(lat);
    const longitude = Number(lon);
    // 0,0 é o "sem coordenada" de muitos cadastros, não um ponto no Brasil.
    if (latitude === 0 && longitude === 0) continue;
    const doDsei = (porDsei[chave] ||= { polos: [], sede: null });
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

export function aplicarLocalizacoes(
  lmap: unknown,
  porDsei: LocalizacoesPorDsei | null | undefined,
): unknown {
  const base = registro(lmap);
  if (!base || !Array.isArray(base.dsei) || !porDsei) return lmap;
  if (!Object.keys(porDsei).length) return lmap;
  return {
    ...base,
    dsei: (base.dsei as unknown[]).map((valor) => {
      const dsei = registro(valor);
      if (!dsei) return valor;
      const doDsei = porDsei[chaveDoDsei(dsei.k)];
      if (!doDsei) return dsei;
      const { sede } = doDsei;
      return {
        ...dsei,
        polos: doDsei.polos,
        ...(sede
          ? {
              lat: sede.lat,
              lon: sede.lon,
              sede_municipio: sede.municipio || dsei.sede_municipio,
              sede_uf: sede.uf || dsei.sede_uf,
              sede_origem: ORIGEM_SIGEPSI,
            }
          : {}),
      };
    }),
  };
}
