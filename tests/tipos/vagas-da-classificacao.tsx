import {
  convocacaoDoEdital,
  modeloDaRegra,
  vagasPelaConta,
} from "../../src/lib/classificacao/convocacao-do-edital.ts";
import {
  montarVagas,
  vagasPelosPercentuais,
} from "../../src/lib/classificacao/vagas.ts";
import type { VagaMontada } from "../../src/lib/classificacao/tipos-das-vagas.ts";

const modelo = modeloDaRegra({});
if (modelo) {
  const quantidade: number | undefined = vagasPelaConta(3, modelo).AC;
  void quantidade;
  // @ts-expect-error A conta recebe um total já numérico.
  vagasPelaConta("3", modelo);
}
const vagas: VagaMontada[] = montarVagas({
  candidatos: [{ vaga: "123", cargo: "Analista", quadroId: "q1" }],
  quadro: [
    { id: "q1", vagas_imediatas: "3", modalidades: { AC: "2", PP: "1" } },
  ],
  convocacao: convocacaoDoEdital({}, "e1"),
});
const total: number | null | undefined = vagas[0]?.total;
void total;
// @ts-expect-error Percentuais operam sobre totais normalizados.
vagasPelosPercentuais("3", {});
// @ts-expect-error O quadro por modalidade é um registro, não uma lista.
montarVagas({ quadro: [{ modalidades: [] }] });
