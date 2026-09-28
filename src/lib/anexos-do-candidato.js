/*
  Anexos do candidato aprovado: só PDF, até 2 MB cada, até 5 por candidato.
  Os mesmos limites estão no banco (bucket e `registrar_anexo_candidato_aprovado`,
  migration 20260928140000); aqui eles viram aviso antes do envio.
*/

export const BUCKET_DE_ANEXOS = "anexos-candidatos-aprovados";
export const LIMITE_DO_ANEXO = 2 * 1024 * 1024;
export const MAXIMO_DE_ANEXOS = 5;
export const TIPO_DO_ANEXO = "application/pdf";

const ehPdf = (arquivo) =>
  arquivo?.type === TIPO_DO_ANEXO ||
  (!arquivo?.type && /\.pdf$/i.test(String(arquivo?.name ?? "")));

/**
 * Confere os arquivos escolhidos contra os limites, contando os que o
 * candidato já tem. Devolve a mensagem do primeiro problema, ou "".
 */
export function problemaDosAnexos(arquivos, jaAnexados = 0) {
  const lista = Array.from(arquivos ?? []);
  if (!lista.length) return "";
  const naoPdf = lista.find((arquivo) => !ehPdf(arquivo));
  if (naoPdf) return `"${naoPdf.name}" não é PDF. Só PDF é aceito.`;
  const grande = lista.find((arquivo) => arquivo.size > LIMITE_DO_ANEXO);
  if (grande) return `"${grande.name}" passa de 2 MB.`;
  const vazio = lista.find((arquivo) => !arquivo.size);
  if (vazio) return `"${vazio.name}" está vazio.`;
  const restam = Math.max(MAXIMO_DE_ANEXOS - jaAnexados, 0);
  if (lista.length > restam)
    return restam
      ? `Cabem só mais ${restam} anexo(s): o limite é ${MAXIMO_DE_ANEXOS} por candidato.`
      : `O candidato já tem ${MAXIMO_DE_ANEXOS} anexos, o limite.`;
  return "";
}

/** candidato_id → anexos dele, na ordem em que foram incluídos. */
export function anexosPorCandidato(linhas) {
  const mapa = new Map();
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    const chave = String(linha?.candidato_id ?? "");
    if (!chave) continue;
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(linha);
  }
  return mapa;
}

/** "850 KB", "1,4 MB". */
export function formatarTamanho(bytes) {
  const valor = Number(bytes) || 0;
  if (valor < 1024 * 1024) return `${Math.max(1, Math.round(valor / 1024))} KB`;
  return `${(valor / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
