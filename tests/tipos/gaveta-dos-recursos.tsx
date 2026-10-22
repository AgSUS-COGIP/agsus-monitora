import { GavetaDoRecurso } from "../../src/modulos/recursos/gaveta.tsx";
import { SecaoDoParecer } from "../../src/modulos/recursos/parecer.tsx";
import { SecaoDeAnexos } from "../../src/modulos/recursos/anexos.tsx";
import { acoesDoParecer } from "../../src/lib/parecer-do-recurso.ts";
import type {
  PropsDaGavetaDoRecurso,
  PropsDaSecaoDoRecurso,
  AnexoDoRecurso,
} from "../../src/modulos/recursos/tipos-da-gaveta.ts";
import type { AcaoDoParecer } from "../../src/modulos/recursos/tipos-do-estado.ts";

function conferir(
  gaveta: PropsDaGavetaDoRecurso,
  secao: PropsDaSecaoDoRecurso,
  anexo: AnexoDoRecurso,
) {
  const tela = (
    <>
      <GavetaDoRecurso {...gaveta} />
      <SecaoDoParecer {...secao} podeDecidir />
      <SecaoDeAnexos {...secao} />
    </>
  );
  const acoes: AcaoDoParecer[] = acoesDoParecer({
    situacao: secao.recurso.situacao,
    podeDecidir: true,
  }).map((a) => a.acao);
  void secao.estado.baixarAnexo(anexo);
  // @ts-expect-error Uma seção não aceita um recurso sem os cálculos do painel.
  const incompleta = <SecaoDeAnexos {...secao} recurso={{ id: "r1" }} />;
  // @ts-expect-error A ação jurídica pertence ao conjunto de transições permitido.
  const acaoInvalida: AcaoDoParecer = "aprovar";
  // @ts-expect-error O indicador de atividade precisa ser booleano.
  const anexoInvalido: AnexoDoRecurso = { ...anexo, ativo: "true" };
  return { tela, acoes, incompleta, acaoInvalida, anexoInvalido };
}
void conferir;
