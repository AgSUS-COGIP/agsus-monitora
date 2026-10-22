/*
  As perguntas que a Aya não resolveu ("não ajudou" ou "não entendi"), para
  melhorar a base de docs/aya. Sem DOM e sem rede: quem guarda no navegador
  é o painel (src/modulos/aya/aya.jsx, localStorage com try/catch) e quem
  leva para a base é o administrador global, pelo botão "Copiar perguntas
  sem resposta".

  Nada de dado pessoal: antes de guardar, e-mail, CPF, telefone e qualquer
  sequência longa de números saem da pergunta (o número do edital, "93/2026",
  fica), e o texto é cortado em 200 caracteres. A página e o motivo vão
  junto; quem perguntou, não.
*/

export const LIMITE_DE_PERGUNTAS = 100;
const TAMANHO_MAXIMO = 200;

/** A pergunta sem e-mail, CPF, telefone ou número longo, em uma linha só. */
export function limparPergunta(texto) {
  return String(texto ?? "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[número]")
    .replace(/\(?\b\d{2}\)?\s?\d{4,5}-?\d{4}\b/g, "[número]")
    .replace(/(?<![/\d])\d{5,}(?![/\d])/g, "[número]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAMANHO_MAXIMO);
}

/**
 * A lista com a pergunta nova no fim (sem repetir a mesma pergunta na mesma
 * página), até `LIMITE_DE_PERGUNTAS`. `item`: `{ pergunta, pagina, motivo, quando }`.
 */
export function comPerguntaSemResposta(lista, item) {
  const atual = Array.isArray(lista) ? lista : [];
  const pergunta = limparPergunta(item?.pergunta);
  if (!pergunta) return atual;
  const novo = {
    pergunta,
    pagina: String(item?.pagina || ""),
    motivo: item?.motivo === "nao-entendeu" ? "nao-entendeu" : "nao-ajudou",
    quando: String(item?.quando || ""),
  };
  const sem = atual.filter(
    (p) => !(p?.pergunta === novo.pergunta && p?.pagina === novo.pagina),
  );
  return [...sem, novo].slice(-LIMITE_DE_PERGUNTAS);
}

/** O que guardado ainda vale (descarta o que não tem a forma certa). */
export function perguntasGuardadas(bruto) {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((p) => p && typeof p.pergunta === "string" && p.pergunta.trim())
    .map((p) => ({
      pergunta: limparPergunta(p.pergunta),
      pagina: String(p.pagina || ""),
      motivo: p.motivo === "nao-entendeu" ? "nao-entendeu" : "nao-ajudou",
      quando: String(p.quando || ""),
    }))
    .slice(-LIMITE_DE_PERGUNTAS);
}

const MOTIVO = Object.freeze({
  "nao-ajudou": "não ajudou",
  "nao-entendeu": "não entendi",
});

/** O texto que vai para a área de transferência: uma pergunta por linha. */
export function textoDasPerguntas(lista) {
  return perguntasGuardadas(lista)
    .map(
      (p) =>
        `- ${p.pergunta} (${p.pagina || "sem página"}; ${MOTIVO[p.motivo]}${p.quando ? `; ${p.quando.slice(0, 10)}` : ""})`,
    )
    .join("\n");
}
