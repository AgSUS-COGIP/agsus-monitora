import {
  CartaoDeAvisos,
  SeloDeAvisos,
  abrirCaso,
} from "../../src/modulos/conferencias/avisos-de-conferencia.tsx";
import { criarEstadoDosAvisos } from "../../src/modulos/conferencias/estado.ts";
import {
  normalizarCaso,
  normalizarAvisos,
  destinoDoCaso,
} from "../../src/lib/avisos-de-conferencia.ts";
import type {
  ClienteDosAvisos,
  EstadoDosAvisos,
  AbrirCaso,
} from "../../src/modulos/conferencias/tipos.ts";

const cliente: ClienteDosAvisos = {
  rpc: () => Promise.resolve({ data: null, error: null }),
};
const estado: EstadoDosAvisos = criarEstadoDosAvisos({ supabase: cliente });
const caso = normalizarCaso({
  conferencia: "ANALISE_DATA_INVALIDA",
  analise_id: "a1",
});
const abrir: AbrirCaso = abrirCaso;
const componentes = [
  <CartaoDeAvisos estado={estado} aoAbrirCaso={abrir} />,
  <SeloDeAvisos modulo="analises" estado={estado} />,
];
void componentes;
void estado.carregar({ area: "sede", modulo: "analises" });
void estado.exportarCasos({
  aviso: { id: "av1", conferencia: "ANALISE_DATA_INVALIDA" },
});
const destino = destinoDoCaso(caso);
if (destino?.view === "approved")
  destino.filtro.candidatos.map((id) => id.toUpperCase());
if (destino?.view === "entrevistas") destino.filtro.entrevista?.toUpperCase();
normalizarAvisos({ avisos: [] }).abertos.map((aviso) => aviso.gravidade);

// @ts-expect-error O cliente do módulo não aceita novas RPCs.
void cliente.rpc("rpc_inexistente", {});
// @ts-expect-error A paginação exige número.
void estado.listarCasos({ deslocamento: "50" });
// @ts-expect-error A ação exige motivo textual.
void estado.ignorar("av1", 15);
// @ts-expect-error Snapshot só pode ser alterado pelas ações do estado.
estado.obter().status = "ready";
// @ts-expect-error A lista exposta não pode ser alterada pelo consumidor.
estado.obter().lista?.abertos.push(normalizarAvisos({}).abertos[0]);
// @ts-expect-error O selo exige o módulo.
const semModulo = <SeloDeAvisos estado={estado} />;
void semModulo;
// @ts-expect-error Callback de abertura recebe um caso normalizado.
const aberturaInvalida: AbrirCaso = (id: number) => void id;
void aberturaInvalida;
