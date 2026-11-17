import { aplicarCoordenada } from "../../src/lib/coordenadas-dos-projetos.ts";
import type { MunicipioDoMapa } from "../../src/modulos/mapa-de-projetos/tipos.ts";

const municipios: readonly MunicipioDoMapa[] = [];
const atualizados: readonly MunicipioDoMapa[] = aplicarCoordenada(
  municipios,
  "irati/PR",
  -25,
  -50,
);
// @ts-expect-error A aplicação de correções recebe coordenadas numéricas.
aplicarCoordenada(municipios, "irati/PR", "-25", -50);
void [atualizados];
