import type {
  AcaoDoEditor,
  FonteDoEditor,
} from "../../src/modulos/editor-de-coordenadas/tipos.ts";
import type {
  FiltroDeGravidade,
  PontoDoEditor,
} from "../../src/lib/tipos-do-editor-de-coordenadas.ts";
import {
  filaDoEditor,
  correcaoDesfazivel,
} from "../../src/lib/editor-de-coordenadas.ts";
import { FONTE_DE_PROJETOS } from "../../src/modulos/mapa-de-projetos/editor-de-coordenadas.tsx";
import type { PontoEditavelDoProjeto } from "../../src/modulos/mapa-de-projetos/tipos.ts";
import { SugestoesDoPonto } from "../../src/modulos/editor-de-coordenadas/sugestoes-do-ponto.tsx";

const fonte: FonteDoEditor<PontoEditavelDoProjeto> = FONTE_DE_PROJETOS;
const ponto: PontoEditavelDoProjeto = {
  id: "irati/PR",
  nome: "Irati/PR",
  latitude: null,
  longitude: null,
  alvo: { lugar: "irati/PR" },
  nivel: "municipio",
  uf: "PR",
  localidade: "CCE",
};
const fila = fonte.fila([ponto], [], { gravidade: "erro" });
if (fila.itens[0]) {
  const lugar: string = fila.itens[0].alvo.lugar;
  void lugar;
}
const alteracao = correcaoDesfazivel([
  { id: 1, acao: "CORRECAO", latitude_anterior: -12, longitude_anterior: -50 },
]);
if (alteracao) {
  const id: number = alteracao.id;
  void id;
}
// @ts-expect-error Somente ações com confirmação previstas pelo editor.
const acao: AcaoDoEditor = "excluir";
// @ts-expect-error Gravidade tem quatro níveis definidos.
const filtro: FiltroDeGravidade = "urgente";
const invalido: PontoDoEditor = {
  id: "x",
  nome: "X",
  // @ts-expect-error Uma coordenada nula é explícita; texto não é posição de um ponto.
  latitude: "-12",
  longitude: -50,
};
// @ts-expect-error A fila exige as regras do mapa.
filaDoEditor([ponto], [], {}, {});
const props: Parameters<typeof SugestoesDoPonto>[0] = {
  sugestoes: [],
  // @ts-expect-error Usar uma sugestão entrega a sugestão completa.
  aoUsar: (id: string) => void id,
};
const sugestoes = <SugestoesDoPonto {...props} />;
void [acao, filtro, invalido, sugestoes];
