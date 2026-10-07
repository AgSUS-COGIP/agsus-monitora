/*
  Anexos do chat (src/modulos/chat/), sem DOM: os tipos aceitos, o limite, a
  validação antes do envio, o caminho no Storage e o nome do print colado.

  O bucket `chat-anexos` é privado
  (supabase/migrations/20261007210000_chat_v2.sql). O caminho é
  `<conversa>/<uuid>.<extensão>` — o nome original vai só para o banco, nunca
  para o caminho. As políticas do Storage leem o caminho: envia quem lê a
  conversa; lê (URL assinada curta) quem lê uma conversa com o anexo ativo.
  Tamanho e tipo são conferidos aqui (para avisar antes), no bucket e pela
  RPC de envio, que lê o que o Storage gravou — o navegador não decide.
*/

import { tamanhoLegivel } from "./anexos-do-recurso.js";

export const BUCKET_DO_CHAT = "chat-anexos";
export const LIMITE_DO_ANEXO_DO_CHAT = 10 * 1024 * 1024;
export const MAXIMO_DE_ANEXOS = 5;
/** Validade da URL assinada (miniatura e download), em segundos. */
export const VALIDADE_DA_URL_DO_ANEXO = 60;

/*
  Espelho de private."FC_CHAT_TIPOS_ANEXO"() e do CHECK
  CK_ANEXOMENSAGEM_DSMIME: PDF, imagem e planilha.
*/
export const TIPOS_DE_ANEXO = Object.freeze([
  Object.freeze({
    extensoes: ["pdf"],
    mime: "application/pdf",
    familia: "pdf",
  }),
  Object.freeze({ extensoes: ["png"], mime: "image/png", familia: "imagem" }),
  Object.freeze({
    extensoes: ["jpg", "jpeg"],
    mime: "image/jpeg",
    familia: "imagem",
  }),
  Object.freeze({ extensoes: ["webp"], mime: "image/webp", familia: "imagem" }),
  Object.freeze({ extensoes: ["gif"], mime: "image/gif", familia: "imagem" }),
  Object.freeze({ extensoes: ["csv"], mime: "text/csv", familia: "planilha" }),
  Object.freeze({
    extensoes: ["xlsx"],
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    familia: "planilha",
  }),
  Object.freeze({
    extensoes: ["xls"],
    mime: "application/vnd.ms-excel",
    familia: "planilha",
  }),
  Object.freeze({
    extensoes: ["ods"],
    mime: "application/vnd.oasis.opendocument.spreadsheet",
    familia: "planilha",
  }),
]);

/** Para o `accept` do `<input type="file">`. */
export const ACEITA_NO_SELETOR_DO_CHAT = TIPOS_DE_ANEXO.flatMap((t) =>
  t.extensoes.map((e) => `.${e}`),
).join(",");

const extensao = (nome) => {
  const partes = String(nome ?? "")
    .toLowerCase()
    .split(".");
  return partes.length > 1 ? partes.at(-1) : "";
};

/*
  O tipo sai da extensão. Print colado (sem nome ou "image.png") vem com o
  tipo do navegador. Se o navegador mandou um tipo que é OUTRO dos aceitos, a
  extensão engana e o arquivo é recusado. (O Windows manda .csv como
  application/vnd.ms-excel: os dois são planilha, então vale.)
*/
export function tipoDoAnexo(arquivo) {
  const doNavegador = String(arquivo?.type || "");
  const porExtensao = TIPOS_DE_ANEXO.find((t) =>
    t.extensoes.includes(extensao(arquivo?.name)),
  );
  if (!porExtensao) {
    const porMime = TIPOS_DE_ANEXO.find((t) => t.mime === doNavegador);
    return porMime?.familia === "imagem" ? porMime : null;
  }
  const outro = TIPOS_DE_ANEXO.find((t) => t.mime === doNavegador);
  if (outro && outro !== porExtensao && outro.familia !== porExtensao.familia)
    return null;
  return porExtensao;
}

/** `{ mime, extensao, familia }` se o arquivo pode ir, `{ erro }` se não. */
export function validarAnexoDoChat(arquivo) {
  if (!arquivo) return { erro: "Escolha o arquivo." };
  const tipo = tipoDoAnexo(arquivo);
  if (!tipo)
    return {
      erro: "Tipo de arquivo não aceito. Use PDF, imagem (PNG, JPG, WEBP, GIF) ou planilha (XLSX, XLS, ODS, CSV).",
    };
  if (!arquivo.size) return { erro: "O arquivo está vazio." };
  if (arquivo.size > LIMITE_DO_ANEXO_DO_CHAT)
    return { erro: "O arquivo passa de 10 MB." };
  if (String(arquivo.name || "").trim().length > 200)
    return { erro: "O nome do arquivo passa de 200 caracteres." };
  const ext = tipo.extensoes.includes(extensao(arquivo.name))
    ? extensao(arquivo.name)
    : tipo.extensoes[0];
  return { mime: tipo.mime, extensao: ext, familia: tipo.familia };
}

/**
 * Junta arquivos novos aos já escolhidos: no máximo `MAXIMO_DE_ANEXOS`;
 * os que não valem voltam em `recusados` com o motivo.
 */
export function juntarAnexos(atuais, novos, maximo = MAXIMO_DE_ANEXOS) {
  const lista = Array.isArray(atuais) ? [...atuais] : [];
  const recusados = [];
  for (const arquivo of Array.from(novos || [])) {
    const validacao = validarAnexoDoChat(arquivo);
    if (validacao.erro) {
      recusados.push({
        nome: arquivo?.name || "arquivo",
        erro: validacao.erro,
      });
      continue;
    }
    if (lista.length >= maximo) {
      recusados.push({
        nome: arquivo?.name || "arquivo",
        erro: `No máximo ${maximo} anexos por mensagem.`,
      });
      continue;
    }
    lista.push({ arquivo, ...validacao });
  }
  return { anexos: lista, recusados };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * `<conversa>/<id>.<extensão>` — a forma que as políticas do bucket e a RPC
 * de envio aceitam. Lança com ids ou extensão fora do formato.
 */
export function caminhoDoAnexoDoChat(conversa, id, ext) {
  if (!UUID.test(String(conversa ?? "")) || !UUID.test(String(id ?? "")))
    throw new Error("Identificador inválido para o anexo.");
  const e = String(ext ?? "").toLowerCase();
  if (!TIPOS_DE_ANEXO.some((t) => t.extensoes.includes(e)))
    throw new Error("Extensão inválida para o anexo.");
  return `${conversa}/${id}.${e}`;
}

const dois = (n) => String(n).padStart(2, "0");

/** Nome do print colado (Ctrl+V): "print-2026-10-07-14h05m09.png". */
export function nomeDoPrint(agora = new Date(), ext = "png") {
  const d = agora instanceof Date ? agora : new Date(agora);
  return `print-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}h${dois(d.getMinutes())}m${dois(d.getSeconds())}.${ext}`;
}

/** Os arquivos de imagem colados (clipboardData.files / items). */
export function imagensColadas(dados) {
  const arquivos = Array.from(dados?.files || []);
  if (arquivos.length)
    return arquivos.filter((a) => String(a?.type).startsWith("image/"));
  return Array.from(dados?.items || [])
    .filter((i) => i?.kind === "file" && String(i.type).startsWith("image/"))
    .map((i) => i.getAsFile?.())
    .filter(Boolean);
}

export const ehImagem = (mime) => String(mime || "").startsWith("image/");

/** Ícone (Font Awesome) do anexo pela família do tipo. */
export function iconeDoAnexo(mime) {
  if (ehImagem(mime)) return "fa-file-image";
  if (mime === "application/pdf") return "fa-file-pdf";
  return "fa-file-excel";
}

/** "Relatório.pdf · 1,2 MB". */
export function rotuloDoAnexo(anexo) {
  const tamanho = tamanhoLegivel(anexo?.bytes);
  return [String(anexo?.nome || "arquivo"), tamanho]
    .filter(Boolean)
    .join(" · ");
}

export { tamanhoLegivel };
