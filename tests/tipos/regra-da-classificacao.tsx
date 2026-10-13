import { Regra } from "../../src/modulos/classificacao/regra.tsx";
import { normalizarRegra } from "../../src/lib/classificacao/regra.ts";
import {
  alterarCampoDaRegra,
  alterarGrupoDaRegra,
  alterarListaDaRegra,
} from "../../src/lib/classificacao/edicao-da-regra.ts";
import type { EstadoDaClassificacao } from "../../src/modulos/classificacao/tipos-do-estado.ts";
import type { RascunhoDaRegra } from "../../src/app/rascunho-da-regra.ts";

export function conferirRegra(
  estado: EstadoDaClassificacao,
  rascunho: RascunhoDaRegra,
) {
  const inicial = normalizarRegra(null);
  const editada = alterarGrupoDaRegra(inicial, "composicao", { casas: "3" });
  void estado.salvarRegra(editada, "Motivo", "Versão inicial");
  return (
    <Regra
      estado={estado}
      e={estado.obter()}
      dataDeCorte={null}
      rascunhoGuardado={rascunho}
    />
  );
}
export function rejeitarCamposInvalidos() {
  const regra = normalizarRegra(null);
  // @ts-expect-error Uma etapa é booleana, mesmo no rascunho.
  alterarGrupoDaRegra(regra, "etapas", { entrevista: "sim" });
  // @ts-expect-error Critérios de comparação não pertencem à composição da nota.
  alterarGrupoDaRegra(regra, "composicao", { desempate: [] });
  // @ts-expect-error O rodapé é textual.
  alterarCampoDaRegra(regra, "rodape", 7);
  // @ts-expect-error A convocação utiliza a ordem da preliminar, sem configuração própria de empate.
  alterarListaDaRegra(regra, "CONVOCACAO", { empate: "CRITERIOS" });
}
