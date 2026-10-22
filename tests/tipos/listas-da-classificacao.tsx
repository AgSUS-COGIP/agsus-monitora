import {
  Indicadores,
  Listas,
  MarcaDoRecurso,
} from "../../src/modulos/classificacao/listas.tsx";
import { calcularClassificacao } from "../../src/modulos/classificacao/classificacao.tsx";
import {
  recortarResultado,
  RECORTE_VAZIO,
} from "../../src/lib/classificacao/dados.ts";
import type { EstadoDaClassificacao } from "../../src/modulos/classificacao/tipos-do-estado.ts";
import type {
  LinhaDaLista,
  PendenciaDeEmpate,
} from "../../src/lib/classificacao/tipos-do-resultado.ts";

export function conferirListas(estado: EstadoDaClassificacao) {
  const resultado = calcularClassificacao(estado.obter().dados, "FINAL");
  const vagas = recortarResultado(resultado, RECORTE_VAZIO);
  const linha: LinhaDaLista | undefined = vagas[0]?.linhas[0];
  return (
    <>
      <Listas
        estado={estado}
        e={estado.obter()}
        calcular={calcularClassificacao}
        aoAbrirAgenda={() => {}}
      />
      <Indicadores resultado={resultado} carregando={false} />
      <MarcaDoRecurso recursos={linha?.recursos} />
    </>
  );
}
export function rejeitarDadosIncompletos(pendencia: PendenciaDeEmpate) {
  // @ts-expect-error O recorte exige o contrato completo do resultado, incluindo avisos e totais.
  recortarResultado({ vagas: [] });
  // @ts-expect-error Números de recursos não são identificadores de análise.
  const marca = <MarcaDoRecurso recursos={["a1"]} />;
  // @ts-expect-error Empate final aceita sorteio ou decisão manual.
  pendencia.metodo = "NOME";
  return marca;
}
