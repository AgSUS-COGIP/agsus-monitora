import type { FonteDoEditor } from "../../src/modulos/editor-de-coordenadas/tipos.ts";
import type { PontoEditavelIndigena } from "../../src/lib/tipos-das-coordenadas-do-mapa.ts";
import { FONTE_DA_SAUDE_INDIGENA } from "../../src/modulos/mapa-saude-indigena/editor-de-coordenadas.tsx";
import { pontosEditaveisDoMapa } from "../../src/lib/coordenadas-do-mapa.ts";
import { aplicarCoordenada } from "../../src/lib/coordenadas-dos-projetos.ts";
import type { MunicipioDoMapa } from "../../src/modulos/mapa-de-projetos/tipos.ts";

const fonte: FonteDoEditor<PontoEditavelIndigena> = FONTE_DA_SAUDE_INDIGENA;
const pontos = pontosEditaveisDoMapa({}, {});
const fila = fonte.fila(pontos, [], {});
if (fila.itens[0]) {
  const indice: number = fila.itens[0].alvo.indice;
  const codigo: string | null = fila.itens[0].alvo.codigo;
  void [indice, codigo];
}
const alvo: PontoEditavelIndigena["alvo"] = {
  fonte: "lmap",
  tipo: "polo",
  dsei: "XINGU",
  indice: 0,
  codigo: "001",
  nome: "Polo A",
};
const alvoInvalido: PontoEditavelIndigena["alvo"] = {
  ...alvo,
  // @ts-expect-error O índice é a posição numérica na fonte original.
  indice: "0",
};
const municipios: readonly MunicipioDoMapa[] = [];
const atualizados: readonly MunicipioDoMapa[] = aplicarCoordenada(
  municipios,
  "irati/PR",
  -25,
  -50,
);
// @ts-expect-error A fonte indígena exige a identidade completa do alvo.
fonte.chaveDoPonto({ id: "x", nome: "X", latitude: null, longitude: null });
// @ts-expect-error A aplicação de correções recebe coordenadas numéricas.
aplicarCoordenada(municipios, "irati/PR", "-25", -50);
void [alvoInvalido, atualizados];
