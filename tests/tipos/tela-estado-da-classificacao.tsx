import {
  TelaDeClassificacao,
  montarClassificacao,
} from "../../src/modulos/classificacao/classificacao.tsx";
import { criarEstadoDaClassificacao } from "../../src/modulos/classificacao/estado.ts";
import type {
  EstadoDaAgenda,
  SnapshotDaClassificacao,
  ListaRegistrada,
} from "../../src/modulos/classificacao/tipos-do-estado.ts";
function conferir(agenda: EstadoDaAgenda, lista: ListaRegistrada) {
  const estado = criarEstadoDaClassificacao({
    toast: (mensagem, tom) => {
      void [mensagem, tom];
    },
    supabase: {
      rpc: async (nome, argumentos) => ({
        data: { nome, argumentos },
        error: null,
      }),
    },
  });
  const snapshot: SnapshotDaClassificacao = estado.obter();
  const tela = <TelaDeClassificacao estado={estado} agenda={agenda} />;
  void montarClassificacao({ secao: null, areaAtual: () => "sede" });
  void estado.publicarLista(lista.id);
  // @ts-expect-error O sinalizador de salvamento precisa ser booleano.
  const invalido: SnapshotDaClassificacao = { ...snapshot, salvando: "true" };
  // @ts-expect-error A versão da regra é numérica.
  void estado.renomearVersao("2", "Versão", "Motivo");
  // @ts-expect-error Um registro de lista precisa de identificador.
  const listaInvalida: ListaRegistrada = { tipo: "FINAL" };
  return { tela, invalido, listaInvalida };
}
void conferir;
