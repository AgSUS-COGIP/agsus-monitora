import {
  SaudeDasCargas,
  montarSaudeDasCargas,
} from "../../src/componentes/saude-das-cargas/saude-das-cargas.tsx";
import { criarEstadoDaSaude } from "../../src/componentes/saude-das-cargas/estado.ts";
import {
  normalizarSaude,
  visaoSimples,
} from "../../src/lib/saude-das-cargas.ts";
import {
  normalizarPainel,
  normalizarVagas,
} from "../../src/lib/painel-dos-robos.ts";
import type {
  ClienteDaSaude,
  EstadoDaSaude,
  OpcoesConferidas,
} from "../../src/componentes/saude-das-cargas/tipos.ts";

const cliente: ClienteDaSaude = {
  rpc: () => Promise.resolve({ data: null, error: null }),
};
const estado: EstadoDaSaude = criarEstadoDaSaude({
  supabase: cliente,
  getProfile: () => ({ perfil: "admin" }),
});
const tela = <SaudeDasCargas estado={estado} supabase={cliente} />;
void tela;
const opcoes: OpcoesConferidas = {
  modo: "seco",
  editais: [],
  vagas: ["123"],
  limite: 1,
};
void estado.rodarComOpcoes("empregare", opcoes);
void estado.buscarVagas({ editais: ["ed1"], vagas: ["123"] });
visaoSimples(normalizarSaude({})).linhas.map((linha) => linha.situacao);
normalizarPainel({}).editais.map((edital) => edital.numero);
normalizarVagas([]).map((vaga) => vaga.ultimaCarga?.getTime());
void montarSaudeDasCargas({ raizDaTela: null, supabase: null });

// @ts-expect-error A busca recebe listas de identificadores textuais.
void estado.buscarVagas({ editais: [1] });
// @ts-expect-error O limite validado é numérico.
void estado.rodarComOpcoes("empregare", { ...opcoes, limite: "60" });
// @ts-expect-error O status só muda pelas ações do estado.
estado.obter().status = "ready";
// @ts-expect-error A API de agendamento recebe callback, não texto.
const agendamentoInvalido: (fn: () => void, ms: number) => unknown = (
  fn: string,
) => void fn;
void agendamentoInvalido;
// @ts-expect-error O cliente não expõe RPCs fora das fronteiras declaradas.
void cliente.rpc("rpc_inexistente");
// @ts-expect-error A tela exige o estado externo.
const semEstado = <SaudeDasCargas supabase={cliente} />;
void semEstado;
