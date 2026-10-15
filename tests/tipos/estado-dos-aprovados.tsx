import type {
  ClienteDosAprovados,
  ModalDosAprovados,
  OpcoesDoEstadoDosAprovados,
} from "../../src/modulos/aprovados/tipos-do-estado.ts";
import type { EstadoDaAbaDeAprovados } from "../../src/modulos/aprovados/tipos-da-aba-de-aprovados.ts";
import type { EstadoDaAbaDaConvocacao } from "../../src/modulos/aprovados/tipos-da-aba-de-convocacao.ts";
import type { EstadoPaiDaCarta } from "../../src/lib/tipos-da-carta.ts";
import type { EstadoDaConfiguracao } from "../../src/lib/tipos-da-configuracao-de-convocacao.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarEstadoDaListaDeAprovados } from "../../src/modulos/aprovados/estado.ts";
import { ListaAprovados } from "../../src/modulos/aprovados/lista-aprovados.tsx";

function contratos(cliente: SupabaseClient) {
  const banco: ClienteDosAprovados = cliente;
  const estado = criarEstadoDaListaDeAprovados({ supabase: banco });
  const aprovados: EstadoDaAbaDeAprovados = estado;
  const convocacao: EstadoDaAbaDaConvocacao = estado;
  const carta: EstadoPaiDaCarta = estado;
  const configuracao: EstadoDaConfiguracao = estado;
  void [aprovados, convocacao, carta, configuracao];
  void (<ListaAprovados estado={estado} />);
  void estado.salvarStatus("ana", {
    status: "Contratado",
    matricula: "M1",
    anexos: [new File(["pdf"], "termo.pdf")],
  });
  // @ts-expect-error Anexos da ação são arquivos, não seus nomes.
  void estado.salvarStatus("ana", { anexos: ["termo.pdf"] });
  // @ts-expect-error O snapshot não pode receber candidatos por mutação da tela.
  estado.obter().candidatos.push({ candidato_id: "ana", nome: "Ana" });
}
void contratos;
// @ts-expect-error Um modal de status precisa identificar o candidato.
const modal: ModalDosAprovados = { tipo: "status" };
void modal;
const opcoes: OpcoesDoEstadoDosAprovados = {
  // @ts-expect-error A janela usada para o anexo também precisa poder fechar.
  novaAba: () => ({ mostrar: (_url: string) => {} }),
};
void opcoes;
