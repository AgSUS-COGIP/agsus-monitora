import { ModalDePublicacaoDeAprovados } from "../../src/modulos/classificacao/publicar-aprovados.tsx";
import type { EstadoDaClassificacao } from "../../src/modulos/classificacao/tipos-do-estado.ts";
import type { VinculoDoPlano } from "../../src/lib/casamento-da-lista.ts";

export function conferirPublicacao(estado: EstadoDaClassificacao) {
  void estado.publicarComoListaDeAprovados({ pedidoId: "p1", motivo: "" });
  void estado.prepararPublicacaoDeAprovados(null, null, { c1: "a1" });
  return (
    <ModalDePublicacaoDeAprovados
      estado={estado}
      registro={{ id: "l1", tipo: "FINAL" }}
      resultado={null}
      analises={new Map()}
      aoFechar={() => {}}
    />
  );
}
export function rejeitarVinculoInvalido() {
  const vinculo: VinculoDoPlano = {
    candidato_id: "c1",
    chave: "a1",
    // @ts-expect-error O banco aceita apenas as quatro formas de vínculo conhecidas.
    forma: "AUTOMATICO",
  };
  return vinculo;
}
