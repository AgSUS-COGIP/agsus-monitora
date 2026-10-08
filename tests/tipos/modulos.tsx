import { ModulosEAbas } from "../../src/modulos/modulos/modulos.tsx";
import { criarEstadoDosModulos } from "../../src/modulos/modulos/estado.ts";
import type {
  AlvoDosModulos,
  ClienteDosModulos,
} from "../../src/modulos/modulos/tipos.ts";

const cliente: ClienteDosModulos = {
  rpc: () => Promise.resolve({ data: null, error: null }),
};
const estado = criarEstadoDosModulos({ supabase: cliente });
const tela = <ModulosEAbas estado={estado} />;
void tela;
estado.mudarEstado({ escopo: "area", area: "sede" }, "manutencao");
estado.mudarCampo(
  { escopo: "aba_area", area: "sede", aba: "editais" },
  "beta",
  "true",
);

// @ts-expect-error A aba de uma área exige ambas as identificações.
const alvo: AlvoDosModulos = { escopo: "aba_area", aba: "editais" };
void alvo;
// @ts-expect-error Painéis não recebem a identificação de uma área.
estado.mudarEstado({ escopo: "painel", painel: "p1", area: "sede" }, "ativa");
// @ts-expect-error Só os estados existentes são aceitos.
estado.mudarEstado({ escopo: "sistema" }, "publicada");
// @ts-expect-error Só os campos existentes são aceitos.
estado.mudarCampo({ escopo: "sistema" }, "titulo", "Novo");
// @ts-expect-error O rascunho é exposto somente para leitura.
estado.obter().rascunho.clear();
// @ts-expect-error O snapshot só muda por ações do estado.
estado.obter().status = "ready";
// @ts-expect-error Apenas as duas RPCs existentes do módulo são aceitas.
void cliente.rpc("nova_rpc");
// @ts-expect-error O motivo do salvamento é textual.
void estado.salvar(42);
