/*
  Anexos do recurso, sem DOM: o bucket, os tipos aceitos, o caminho do
  arquivo e a validação antes do envio.

  O bucket `recursos-anexos` é privado
  (supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql).
  As políticas do Storage leem o caminho `<área>/<recurso>/<uuid>-<nome>`:
  só envia quem edita recursos e vê o edital do recurso; só lê quem registrou
  o download pela RPC nos últimos minutos. Tamanho e tipo são conferidos aqui
  (para avisar antes), no bucket (limite e tipos) e pela RPC de registro, que
  lê o que o Storage gravou — o navegador não decide.
*/

export const BUCKET_DOS_ANEXOS = "recursos-anexos";
export const LIMITE_DO_ANEXO = 20 * 1024 * 1024;
/** Validade da URL assinada do download, em segundos. */
export const VALIDADE_DO_DOWNLOAD = 60;

export const TIPOS_DE_ARQUIVO = Object.freeze([
  Object.freeze({ extensoes: ["pdf"], mime: "application/pdf", rotulo: "PDF" }),
  Object.freeze({
    extensoes: ["docx"],
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    rotulo: "DOCX",
  }),
  Object.freeze({
    extensoes: ["doc"],
    mime: "application/msword",
    rotulo: "DOC",
  }),
  Object.freeze({
    extensoes: ["jpg", "jpeg"],
    mime: "image/jpeg",
    rotulo: "JPG",
  }),
  Object.freeze({ extensoes: ["png"], mime: "image/png", rotulo: "PNG" }),
  Object.freeze({
    extensoes: ["odt"],
    mime: "application/vnd.oasis.opendocument.text",
    rotulo: "ODT",
  }),
]);

/** Para o `accept` do `<input type="file">`. */
export const ACEITA_NO_SELETOR = TIPOS_DE_ARQUIVO.flatMap((t) =>
  t.extensoes.map((e) => `.${e}`),
).join(",");

export const TIPOS_DE_ANEXO = Object.freeze([
  Object.freeze({ id: "recurso_candidato", rotulo: "Recurso do candidato" }),
  Object.freeze({ id: "documento", rotulo: "Documento" }),
  Object.freeze({ id: "resposta", rotulo: "Resposta" }),
  Object.freeze({ id: "outro", rotulo: "Outro" }),
]);

export const rotuloDoTipoDeAnexo = (id) =>
  TIPOS_DE_ANEXO.find((t) => t.id === id)?.rotulo || "Anexo";

const extensao = (nome) => {
  const partes = String(nome ?? "")
    .toLowerCase()
    .split(".");
  return partes.length > 1 ? partes.at(-1) : "";
};

/*
  O tipo sai da extensão (o navegador às vezes manda vazio para .doc/.odt);
  se o navegador mandou um tipo e ele é outro dos aceitos, a extensão engana e
  o arquivo é recusado.
*/
export function tipoDoArquivo(arquivo) {
  const porExtensao = TIPOS_DE_ARQUIVO.find((t) =>
    t.extensoes.includes(extensao(arquivo?.name)),
  );
  if (!porExtensao) return null;
  const doNavegador = String(arquivo?.type || "");
  if (
    doNavegador &&
    doNavegador !== porExtensao.mime &&
    TIPOS_DE_ARQUIVO.some((t) => t.mime === doNavegador)
  )
    return null;
  return porExtensao;
}

/** `{ mime }` se o arquivo pode ir, `{ erro }` se não. */
export function validarArquivoDoAnexo(arquivo) {
  if (!arquivo) return { erro: "Escolha o arquivo." };
  const tipo = tipoDoArquivo(arquivo);
  if (!tipo)
    return {
      erro: "Tipo de arquivo não aceito. Use PDF, DOCX, DOC, JPG, PNG ou ODT.",
    };
  if (!arquivo.size) return { erro: "O arquivo está vazio." };
  if (arquivo.size > LIMITE_DO_ANEXO)
    return { erro: "O arquivo passa de 20 MB." };
  if (String(arquivo.name || "").trim().length > 200)
    return { erro: "O nome do arquivo passa de 200 caracteres." };
  return { mime: tipo.mime };
}

/** Nome para a chave do Storage: sem acento, espaço nem símbolo; até 120 caracteres. */
export function nomeSeguroDoAnexo(nome) {
  const limpo = String(nome ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/-+\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (!limpo) return "arquivo";
  if (limpo.length <= 120) return limpo;
  const ext = extensao(limpo);
  const base = limpo.slice(0, 120 - (ext ? ext.length + 1 : 0));
  return ext ? `${base}.${ext}` : base;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `<área>/<recurso>/<uuid>-<nome seguro>` — a forma que as políticas do
 * bucket e a RPC de registro aceitam. Lança com área ou ids fora do formato.
 */
export function caminhoDoAnexo(area, recursoId, id, nome) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(area ?? "")))
    throw new Error("Área inválida para o anexo.");
  if (!UUID.test(String(recursoId ?? "")) || !UUID.test(String(id ?? "")))
    throw new Error("Identificador inválido para o anexo.");
  return `${area}/${recursoId}/${id}-${nomeSeguroDoAnexo(nome)}`;
}

export function tamanhoLegivel(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024)
    return `${kb.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;
  return `${(kb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
