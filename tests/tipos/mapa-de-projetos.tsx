import { MapaDeProjetos } from "../../src/modulos/mapa-de-projetos/mapa-de-projetos.tsx";
import { criarCarregadorDeMunicipios } from "../../src/modulos/mapa-de-projetos/carregador.ts";
import {
  municipiosDaResposta,
  pontosDosMunicipios,
} from "../../src/lib/visao-geral-da-area.ts";
import { balaoDoLugar } from "../../src/modulos/mapa-de-projetos/balao.ts";
import type {
  PontoDoMunicipio,
  ResultadoDosMunicipios,
} from "../../src/modulos/mapa-de-projetos/tipos.ts";

const carregador = criarCarregadorDeMunicipios({ relogio: () => 0 });
const resposta: Promise<ResultadoDosMunicipios> =
  carregador.carregar("projetos");
void resposta;
const municipios = municipiosDaResposta([
  { municipio_uf: "Irati/PR", vagas: "5" },
]);
const pontos: PontoDoMunicipio[] = pontosDosMunicipios(municipios);
if (pontos[0]) balaoDoLugar(document, pontos[0]);
const mapa = (
  <MapaDeProjetos
    carregador={carregador}
    linhas={[{ id: 0, edital: "01/2026" }]}
    filtroAtivo
  />
);
void mapa;
carregador.guardarEscolha({ projeto: "CCE", agrupar: true });
carregador.corrigirCoordenada("uf:PA", -3, -52);

// @ts-expect-error Agrupar é uma escolha booleana.
carregador.guardarEscolha({ agrupar: "sim" });
// @ts-expect-error A correção recebe números, sem coerção implícita.
carregador.corrigirCoordenada("uf:PA", "-3", -52);
// @ts-expect-error Escolha guardada só muda pelo carregador.
carregador.obterEscolha().projeto = "MFC";
// @ts-expect-error A carga é assíncrona mesmo quando responde do cache.
const resultadoSincrono: ResultadoDosMunicipios =
  carregador.carregar("projetos");
void resultadoSincrono;
const cache = carregador.emCache("projetos");
if (cache) {
  // @ts-expect-error A lista em cache é somente para leitura.
  cache.municipios.push(municipios[0]!);
}
const carregadorIncompleto = {
  carregar: async () => ({ municipios: [], indisponivel: false, erro: "" }),
};
// @ts-expect-error O mapa recebe um carregador com operações completas.
const incompleto = <MapaDeProjetos carregador={carregadorIncompleto} />;
void incompleto;
