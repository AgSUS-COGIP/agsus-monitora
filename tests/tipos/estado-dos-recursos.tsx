import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClienteDosRecursos,
  SnapshotDosRecursos,
} from "../../src/modulos/recursos/tipos-do-estado.ts";
import { criarEstadoDosRecursos } from "../../src/modulos/recursos/estado.ts";
import { montarRecursos } from "../../src/modulos/recursos/recursos.tsx";
import { FormularioDoRecurso } from "../../src/modulos/recursos/formulario.tsx";
declare const clienteReal: SupabaseClient;
const cliente: ClienteDosRecursos = clienteReal;
const estado = criarEstadoDosRecursos({ supabase: cliente });
const snapshot: SnapshotDosRecursos = estado.obter();
const tela = (
  <FormularioDoRecurso
    estado={estado}
    recursos={[]}
    editais={[]}
    origens={[]}
  />
);
const controlador = montarRecursos({
  supabase: cliente,
  areaAtual: () => "SEDE",
});
estado.marcarEtapa("r1", "processo_sei", "processo_sei_em", true);
// @ts-expect-error A data deve pertencer à etapa informada.
estado.marcarEtapa("r1", "processo_sei", "upload_sei_em", true);
estado.transicionarRecurso({ id: "r1", revisao: 1 }, "enviar_parecer");
// @ts-expect-error Ação jurídica inexistente não é aceita.
estado.transicionarRecurso({ id: "r1" }, "aprovar");
// @ts-expect-error Etapas do recurso seguem o catálogo existente.
estado.marcarEtapa("r1", "enviado", "processo_sei_em", true);
// @ts-expect-error O cliente só chama as RPCs usadas pelo módulo.
cliente.rpc("apagar_todos_os_recursos");
// @ts-expect-error Consulta não devolve candidato sem identificador.
const candidato: Awaited<ReturnType<typeof estado.buscarCandidatos>>[number] = {
  candidato: "Ana",
};
void [snapshot, tela, controlador, candidato];
