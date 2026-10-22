import {
  bolhasDosDsei,
  casaisNacionais,
  contarPorDsei,
  enquadramentoNacional,
} from "../../src/lib/mapa-saude-indigena/mapa-nacional.ts";
import {
  registrosDoDsei,
  classificarRegistros,
  limitesDoDsei,
  visiveis,
} from "../../src/lib/mapa-saude-indigena/mapa-do-dsei.ts";
import type {
  DseiDoMapa,
  RedeCnesDoMapa,
  RegistroDoDsei,
  ContagemDoDsei,
} from "../../src/lib/mapa-saude-indigena/tipos.ts";
import type { CoordenadasDoMapa } from "../../src/lib/tipos-do-mapa.ts";
import {
  reconciliarDsei,
  unirEstabelecimentosRepetidos,
} from "../../src/lib/reconciliacao-unidades.js";
import { TIPO_POLO } from "../../src/lib/mapa-saude-indigena/formas.ts";

const dsei: DseiDoMapa = {
  k: "CEARA",
  n: "Ceará",
  lat: -3.7,
  lon: -38.5,
  ufs: ["CE"],
};
const rede: RedeCnesDoMapa = {
  rede: { CEARA: { u: [["Polo", 123, -3.7, -38.5, "Fortaleza", 23]], c: [] } },
  nac: [],
};
const contagens: ReadonlyMap<string, ContagemDoDsei> = contarPorDsei([]);
const distritos: readonly DseiDoMapa[] = [dsei];
const bolhas = bolhasDosDsei({ dseis: distritos, contagens });
const casais = casaisNacionais({ nac: rede.nac, contagens });
const pontos: CoordenadasDoMapa[] = enquadramentoNacional({
  bolhas,
  casais,
}).pontos;
const registros: readonly RegistroDoDsei[] = registrosDoDsei(dsei, rede);
const classificados: RegistroDoDsei[] = classificarRegistros(registros, dsei);
const territorio: CoordenadasDoMapa[] = limitesDoDsei(
  dsei,
  classificados,
).territorio;
const visibilidade: RegistroDoDsei[] = visiveis(registros, new Set<string>());

const agrupados = unirEstabelecimentosRepetidos([
  {
    nome: "Polo",
    chave: 123,
    lat: -3.7,
    lon: -38.5,
    identificadorVisual: "polo",
  },
]);
const identificador: string | undefined =
  agrupados.estabelecimentos[0]?.identificadorVisual;
const usados: Set<string | number> = reconciliarDsei({
  dseiChave: dsei.k,
  polos: [],
  estabelecimentos: agrupados.estabelecimentos,
}).estabelecimentosUsados;

bolhasDosDsei({
  // @ts-expect-error Uma contagem de vagas precisa ser numérica.
  contagens: new Map([["CEARA", { editais: 1, vagas: "10", ociosas: 0 }]]),
});
// @ts-expect-error O conjunto guarda chaves dos tipos, não números.
visiveis(registros, new Set([1]));
limitesDoDsei(dsei, [
  {
    id: "polo",
    name: "Polo",
    cnes: 123,
    type: TIPO_POLO,
    // @ts-expect-error O enquadramento recebe registros com coordenadas numéricas.
    lat: "-3.7",
    lon: -38.5,
  },
]);
void [pontos, territorio, visibilidade, identificador, usados];
