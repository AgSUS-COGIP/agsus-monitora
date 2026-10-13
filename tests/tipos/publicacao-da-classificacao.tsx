import { ModalDePublicacaoDeAprovados } from "../../src/modulos/classificacao/publicar-aprovados.tsx";
import {
  argumentosDaPublicacao,
  casarCandidatos,
} from "../../src/lib/publicacao-de-aprovados.ts";
import type { EstadoDaClassificacao } from "../../src/modulos/classificacao/tipos-do-estado.ts";
import type { VinculoDaPublicacao } from "../../src/lib/tipos-da-publicacao-de-aprovados.ts";

export function conferirPublicacao(estado: EstadoDaClassificacao) {
  const vinculos = argumentosDaPublicacao(casarCandidatos([], []));
  void estado.publicarComoListaDeAprovados({ listaId: "l1", vinculos });
  return (
    <ModalDePublicacaoDeAprovados
      estado={estado}
      registro={{ id: "l1", tipo: "FINAL" }}
      analises={new Map()}
      aoFechar={() => {}}
    />
  );
}
export function rejeitarVinculoInvalido() {
  const vinculo: VinculoDaPublicacao = {
    candidato_id: "c1",
    analise_id: "a1",
    // @ts-expect-error O banco aceita apenas as quatro formas de vínculo conhecidas.
    forma: "AUTOMATICO",
  };
  return vinculo;
}
