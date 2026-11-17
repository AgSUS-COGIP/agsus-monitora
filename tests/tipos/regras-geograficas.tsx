import {
  bolhasDosDsei,
  casaisNacionais,
  contarPorDsei,
  enquadramentoNacional,
} from "../../src/lib/mapas/mapa-saude-indigena/mapa-nacional.ts";
import {
  registrosDoDsei,
  classificarRegistros,
  limitesDoDsei,
  visiveis,
} from "../../src/lib/mapas/mapa-saude-indigena/mapa-do-dsei.ts";
import type {
  CasaiNacionalCompacta,
  DseiDoMapa,
  RegistroDoDsei,
  ContagemDoDsei,
} from "../../src/lib/mapas/mapa-saude-indigena/tipos.ts";
import type { CoordenadasDoMapa } from "../../src/lib/mapas/tipos-do-mapa.ts";
import { TIPO_POLO } from "../../src/lib/mapas/mapa-saude-indigena/formas.ts";

const dsei: DseiDoMapa = {
  k: "CEARA",
  n: "Ceará",
  lat: -3.7,
  lon: -38.5,
  ufs: ["CE"],
};
const nac: CasaiNacionalCompacta[] = [
  ["CASAI DF", "131", -15.7, -47.7, "BRASILIA", "DF"],
];
const contagens: ReadonlyMap<string, ContagemDoDsei> = contarPorDsei([]);
const distritos: readonly DseiDoMapa[] = [dsei];
const bolhas = bolhasDosDsei({ dseis: distritos, contagens });
const casais = casaisNacionais({ nac, contagens });
const pontos: CoordenadasDoMapa[] = enquadramentoNacional({
  bolhas,
  casais,
}).pontos;
const registros: readonly RegistroDoDsei[] = registrosDoDsei(dsei);
const classificados: RegistroDoDsei[] = classificarRegistros(registros, dsei);
const territorio: CoordenadasDoMapa[] = limitesDoDsei(
  dsei,
  classificados,
).territorio;
const visibilidade: RegistroDoDsei[] = visiveis(registros, new Set<string>());

bolhasDosDsei({
  // @ts-expect-error Uma contagem de vagas precisa ser numérica.
  contagens: new Map([
    ["CEARA", { editais: 1, vagas: "10", contratadas: 0, ociosas: 0 }],
  ]),
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
void [pontos, territorio, visibilidade];
