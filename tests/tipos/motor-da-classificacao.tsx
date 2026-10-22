import {
  classificar,
  compararValores,
  notaComposta,
  prepararCandidatos,
} from "../../src/lib/classificacao/motor.ts";
import { normalizarRegra } from "../../src/lib/classificacao/regra.ts";
import type { ResultadoDoMotor } from "../../src/lib/classificacao/tipos-do-resultado.ts";

const candidatos = prepararCandidatos([
  { analise_id: "a1", nota_documental: "12,5" },
]);
const candidato = candidatos[0];
if (candidato) {
  const nota: number | null = candidato.notaDocumental;
  void nota;
  notaComposta(candidato, normalizarRegra({}));
  // @ts-expect-error Notas internas são numéricas ou nulas.
  candidato.notaDocumental = "12,5";
}
const resultado: ResultadoDoMotor = classificar({
  candidatos: [{ analise_id: "a1" }],
});
const limite: number | null | undefined =
  resultado.vagas[0]?.limiteConvocacao?.limite;
void limite;
compararValores(null, 3, "MAIOR_PRIMEIRO");
// @ts-expect-error O comparador recebe valores já normalizados.
compararValores("3", 2, "MAIOR_PRIMEIRO");
// @ts-expect-error A unidade é um nome, não uma identidade numérica.
classificar({ unidade: 123 });
