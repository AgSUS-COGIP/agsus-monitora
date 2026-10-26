/*
  O chamado ao suporte que a Aya oferece, sem DOM nem rede.

  O botão "Abrir chamado" abre o Gmail no navegador; um link secundário
  abre o programa de e-mail (`mailto:`) com o assunto e o corpo preenchidos, e nada sai sem ela
  enviar. O endereço é a chave `support_email` de Configurações › Operação
  (padrão abaixo).

  O QUE VAI NO CORPO, E O QUE NÃO VAI

  Só o que a própria pessoa escreveu (a pergunta), a resposta da Aya e o
  contexto da tela (página, área, seção, edital aberto, data e versão). E-mail
  e CPF que apareçam no texto saem mascarados — a pergunta pode ter um dado de
  candidato colado, e ele não deve viajar num e-mail. Token, sessão e dados da
  conta nunca entram.

  O LIMITE DO MAILTO

  Endereço `mailto:` longo demais é cortado (ou recusado) por alguns programas
  de e-mail. O corpo codificado fica em até ~1.800 caracteres: a resposta da
  Aya é cortada primeiro, com "…", e só depois a pergunta.
*/

export const EMAIL_DO_SUPORTE_PADRAO =
  "dados.recursoshumanos@agenciasus.org.br";

/** Limite prático do corpo codificado (encodeURIComponent) do `mailto:`. */
export const LIMITE_DO_CORPO = 1800;

const QUEBRA = "\r\n";
const RETICENCIAS = "…";
const ORIENTACAO = "Descreva aqui o problema e anexe prints, se quiser:";

const txt = (valor) => String(valor ?? "").trim();

/** E-mail num formato aceitável (nome@dominio.tld, sem espaço). */
export function emailValido(valor) {
  return /^[^\s@<>()",;:]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(
    txt(valor),
  );
}

/** O endereço do suporte: o configurado, se válido; senão, o padrão. */
export function emailDoSuporte(configurado) {
  return emailValido(configurado) ? txt(configurado) : EMAIL_DO_SUPORTE_PADRAO;
}

/* Mascara e-mails e CPFs (com ou sem pontuação) de um texto. */
export function semDadosPessoais(texto) {
  return String(texto ?? "")
    .replace(/[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}/gi, "[e-mail omitido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF omitido]");
}

/* "Quero falar com o suporte", "abrir um chamado"… */
const PEDE_SUPORTE =
  /\b(?:falar com (?:o |a )?(?:suporte|atendimento|alguem|uma pessoa|um humano)|abrir (?:um )?chamado|abre (?:um )?chamado|preciso de suporte|quero suporte|contato do suporte|atendimento humano)\b/;

export function pedeSuporte(pergunta) {
  const normalizada = String(pergunta ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return PEDE_SUPORTE.test(normalizada);
}

/** Data e hora de Brasília, como "01/10/2026 14:05". */
export function dataDeBrasilia(quando = new Date()) {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(quando);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${valor("day")}/${valor("month")}/${valor("year")} ${valor("hour")}:${valor("minute")}`;
}

function cortar(texto, tamanho) {
  if (texto.length <= tamanho) return texto;
  return `${texto.slice(0, Math.max(0, tamanho - 1)).trimEnd()}${RETICENCIAS}`;
}

function linhasDoCorpo({ pergunta, resposta, contexto }) {
  return [
    "Chamado aberto pela Aya, assistente do MONITORA.",
    "",
    `Pergunta: ${pergunta || "(sem pergunta)"}`,
    "",
    `Resposta da Aya: ${resposta || "(sem resposta)"}`,
    "",
    ...contexto,
    "",
    ORIENTACAO,
    "",
  ];
}

const tamanhoCodificado = (linhas) =>
  encodeURIComponent(linhas.join(QUEBRA)).length;

/*
  Corta `texto` até o corpo caber no limite, mantendo o resto. Busca binária no
  tamanho: a codificação muda o peso de cada caractere (acentos ocupam 6).
*/
function caberNoLimite(texto, montar, limite) {
  if (tamanhoCodificado(montar(texto)) <= limite) return texto;
  let menor = 0;
  let maior = texto.length;
  while (menor < maior) {
    const meio = Math.ceil((menor + maior) / 2);
    if (tamanhoCodificado(montar(cortar(texto, meio))) <= limite) menor = meio;
    else maior = meio - 1;
  }
  return cortar(texto, menor);
}

/**
 * O chamado: `{ para, assunto, corpo, href, mailto }`. `href` abre o Gmail;
 * `mailto` é a alternativa para o programa de e-mail,
 * com assunto e corpo codificados (quebras de linha em CRLF, %0D%0A).
 */
export function montarChamado({
  email = "",
  pergunta = "",
  resposta = "",
  pagina = "",
  area = "",
  secao = "",
  registro = "",
  versao = "",
  quando = new Date(),
  limite = LIMITE_DO_CORPO,
} = {}) {
  const para = emailDoSuporte(email);
  const nomeDaPagina = txt(pagina) || "MONITORA";
  const assunto = ["MONITORA", "Chamado", nomeDaPagina, txt(area)]
    .filter(Boolean)
    .join(" · ");
  const contexto = [
    `Página: ${nomeDaPagina}`,
    `Área: ${txt(area) || "não informada"}`,
    ...(txt(secao) ? [`Seção de Configurações: ${txt(secao)}`] : []),
    ...(txt(registro) ? [`Registro aberto: ${txt(registro)}`] : []),
    `Data e hora (Brasília): ${dataDeBrasilia(quando)}`,
    `Versão: ${txt(versao) || "não informada"}`,
  ];

  let perguntaLimpa = semDadosPessoais(txt(pergunta));
  let respostaLimpa = semDadosPessoais(txt(resposta));
  respostaLimpa = caberNoLimite(
    respostaLimpa,
    (r) => linhasDoCorpo({ pergunta: perguntaLimpa, resposta: r, contexto }),
    limite,
  );
  perguntaLimpa = caberNoLimite(
    perguntaLimpa,
    (p) => linhasDoCorpo({ pergunta: p, resposta: respostaLimpa, contexto }),
    limite,
  );
  const corpo = linhasDoCorpo({
    pergunta: perguntaLimpa,
    resposta: respostaLimpa,
    contexto,
  }).join(QUEBRA);

  const mailto = `mailto:${para}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  const href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(para)}&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  return { para, assunto, corpo, href, mailto };
}
