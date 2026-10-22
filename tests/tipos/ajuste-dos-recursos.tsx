import {
  SecaoDoAjuste,
  ResumoDaPrevia,
} from "../../src/modulos/recursos/ajuste.tsx";
import {
  montarItens,
  itensParaEnviar,
  listaDaOrigem,
} from "../../src/lib/classificacao/ajustes.ts";
import type {
  ItemDoAjuste,
  PreviaDoAjuste,
  PropostaDoAjuste,
} from "../../src/lib/classificacao/tipos-dos-ajustes.ts";
import type { PropsDaSecaoDoRecurso } from "../../src/modulos/recursos/tipos-da-gaveta.ts";
function conferir(
  props: PropsDaSecaoDoRecurso,
  itens: ItemDoAjuste[],
  previa: PreviaDoAjuste,
) {
  const montados = montarItens(itens, { valores: { FORMACAO: "7,5" } });
  const proposta: PropostaDoAjuste = {
    lista: listaDaOrigem(props.recurso.origem),
    justificativa: null,
    itens: itensParaEnviar(montados),
    previa,
  };
  const tela = (
    <>
      <SecaoDoAjuste {...props} somenteLeitura />
      <ResumoDaPrevia previa={previa} />
    </>
  );
  void props.estado.proporAjuste(props.recurso, proposta);
  // @ts-expect-error Valores de componentes do ajuste são números ou nulos.
  const invalido: Pick<ItemDoAjuste, "atual"> = { atual: "7" };
  // @ts-expect-error A proposta exige uma prévia calculada.
  const incompleta: PropostaDoAjuste = { ...proposta, previa: null };
  // @ts-expect-error A lista da proposta pertence às etapas previstas.
  const listaInvalida: PropostaDoAjuste = { ...proposta, lista: "inventada" };
  return { tela, invalido, incompleta, listaInvalida };
}
void conferir;
