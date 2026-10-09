import { SecaoDaResposta } from "../../src/modulos/recursos/resposta.tsx";
import { PainelDeModelos } from "../../src/modulos/recursos/modelos.tsx";
import { acoesDaResposta } from "../../src/lib/resposta-do-recurso.ts";
import {
  rascunhoDoModelo,
  renderizarModelo,
} from "../../src/lib/modelos-de-resposta.ts";
import type { PropsDaGavetaDoRecurso } from "../../src/modulos/recursos/tipos-da-gaveta.ts";
import type {
  ModeloDaResposta,
  RespostaDoRecurso,
} from "../../src/lib/tipos-da-resposta-do-recurso.ts";
import type { AcaoDaResposta } from "../../src/modulos/recursos/tipos-do-estado.ts";

function conferir(
  props: PropsDaGavetaDoRecurso,
  modelo: ModeloDaResposta,
  resposta: RespostaDoRecurso,
) {
  const tela = (
    <>
      <SecaoDaResposta {...props} modelos={[modelo]} area="sede" acao={null} />
      <PainelDeModelos estado={props.estado} />
    </>
  );
  const rascunho = rascunhoDoModelo(modelo);
  const renderizado: {
    texto: string;
    faltando: string[];
    desconhecidos: string[];
  } = renderizarModelo(rascunho.corpo, { fundamentacao: "Texto" });
  const acoes: AcaoDaResposta[] = acoesDaResposta({
    resposta,
    eu: "u1",
    podeEditar: true,
    podeDecidir: true,
  }).map((a) => a.acao);
  // @ts-expect-error Uma revisão da resposta é um número.
  const invalida: RespostaDoRecurso = { ...resposta, revisao: "3" };
  // @ts-expect-error As transições da resposta não incluem decisões do recurso.
  const acaoInvalida: AcaoDaResposta = "deferir";
  // @ts-expect-error O rascunho do modelo conserva a versão numérica.
  rascunho.versao = "2";
  return { tela, renderizado, acoes, invalida, acaoInvalida };
}
void conferir;
