import {
  normalizarModelo,
  modeloDeReferencia,
} from "../../src/lib/modelo-de-convocacao.ts";
import {
  comDistribuicao,
  rascunhoDoFormulario,
  argumentosDaConfiguracao,
  alterarCategoria,
} from "../../src/lib/configuracao-de-convocacao.ts";
import type {
  EstadoDaConfiguracao,
  ModeloDaConvocacao,
  EditorDaConvocacao,
} from "../../src/lib/tipos-da-configuracao-de-convocacao.ts";
import { FormularioDeConvocacao } from "../../src/modulos/aprovados/formulario-de-convocacao.tsx";
import { EditorDeModelo } from "../../src/modulos/aprovados/editor-de-modelo.tsx";
import { PreviaDaConvocacao } from "../../src/modulos/aprovados/previa-da-convocacao.tsx";
const modelo: ModeloDaConvocacao = normalizarModelo(
  modeloDeReferencia("mgi-simulador"),
);
const editor: EditorDaConvocacao = {
  novo: true,
  base: "mgi-simulador",
  modelo,
  editais: 0,
  abertura: 1,
};
const estado: EstadoDaConfiguracao = {
  assinar: () => () => {},
  obter: () => ({ acao: null }),
  toast: () => {},
  salvarModelo: async () => "m1",
  removerModelo: async () => true,
  salvarConfiguracao: async () => true,
};
void (
  <FormularioDeConvocacao
    ativa
    estado={estado}
    perfil={null}
    editalId="e1"
    candidatos={[]}
    configs={new Map()}
    modelos={new Map([["m1", modelo]])}
  />
);
void (
  <EditorDeModelo
    estado={estado}
    editor={editor}
    totalDaPrevia={10}
    aoAlterar={(f) => void f(modelo)}
    aoEscolherBase={() => {}}
    aoDuplicar={() => {}}
    aoRemover={() => {}}
    aoCancelar={() => {}}
    aoSalvar={() => {}}
  />
);
void (<PreviaDaConvocacao id="previa" modelo={modelo} totalInicial={10} />);
argumentosDaConfiguracao(rascunhoDoFormulario([], new Map(), "e1"));
alterarCategoria(modelo, "pcd", (atual) => ({
  percentual: atual.percentual + 1,
}));
// @ts-expect-error A distribuição deve ser uma regra conhecida.
comDistribuicao(modelo, "aleatoria");
// @ts-expect-error Percentual da categoria é numérico.
alterarCategoria(modelo, "pcd", { percentual: "cinco" });
// @ts-expect-error Total da prévia é numérico.
void (<PreviaDaConvocacao id="previa" modelo={modelo} totalInicial="10" />);
