import {
  readApprovedWorkbook,
  validateApprovedRows,
} from "../../src/lib/aprovados-import.ts";
import {
  anexosPorCandidato,
  arquivoEmBase64,
  problemaDosAnexos,
} from "../../src/lib/anexos-do-candidato.ts";
import { expandirCandidatosCompactos } from "../../src/lib/candidatos-aprovados-compactos.ts";
import type {
  PacoteDeCandidatosCompactos,
  CandidatoDaPlanilhaDeAprovados,
  MetadadosDoPdfDoCandidato,
} from "../../src/lib/tipos-da-importacao-de-aprovados.ts";

async function contratos(arquivo: File, pacote: PacoteDeCandidatosCompactos) {
  const candidatos: CandidatoDaPlanilhaDeAprovados[] =
    await readApprovedWorkbook(arquivo);
  const nota: number | undefined = candidatos[0]?.nota;
  const validados = validateApprovedRows([{ nota: "87,5" }]);
  const posicao: number | undefined = validados.rows[0]?.classificacao;
  const anexos = anexosPorCandidato([
    { candidato_id: "ana", campoExtra: true },
  ]);
  const extra: boolean | undefined = anexos.get("ana")?.[0]?.campoExtra;
  const linhas = expandirCandidatosCompactos(pacote);
  // @ts-expect-error O pacote compacto ainda precisa validar os campos de negócio.
  const nome: string = linhas[0]?.nome;
  void [nota, posicao, extra, nome];
  await arquivoEmBase64(arquivo);
  problemaDosAnexos([arquivo]);
  // @ts-expect-error A conversão binária exige leitura dos bytes do arquivo.
  await arquivoEmBase64({ name: "termo.pdf" });
}
void contratos;
const pdf: MetadadosDoPdfDoCandidato = {
  name: "termo.pdf",
  // @ts-expect-error O tamanho do arquivo é medido em bytes.
  size: "2 MB",
};
void pdf;
