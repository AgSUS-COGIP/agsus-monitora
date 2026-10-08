/*
  O anexo declarado na Empregare, como a ficha o mostra: o endereço do botão
  do anexo, o rótulo e a dica de onde achar o arquivo. Única fonte: a ficha
  (ficha.jsx e ficha/empregare.tsx) não monta link nenhum.

  O link do arquivo não pode ser guardado: fica num storage com assinatura que
  expira (sondagem de 08/10/2026). O robô (scripts/robo-empregare/, com
  --anexos) guarda o identificador da RESPOSTA do candidato ao questionário da
  vaga (migration 20261008160000), e obter_ficha_analise devolve em
  `empregare.link_respostas` a visão de respostas com os anexos
  (/empresa/questionarios/imprimir/<id>|; abre com o login da Empregare).

    enderecos.respostas = linkDasRespostas(dados.empregare);      // ficha.jsx
    const endereco = enderecoDoAnexo(enderecos, coluna);           // { href, destino } | null
    const { rotulo, dica } = apresentacaoDoAnexo(coluna, endereco);
  destino "respostas" → "Ver respostas e anexos na Empregare" e a dica da
  pergunta; sem o identificador, o candidato (o currículo) ou a vaga / a
  lista de vagas, com a dica de antes.
  Sem DOM e sem estado. Testes: tests/lib/avaliacao-documental-anexo-na-empregare.test.js.
*/

/** Os endereços que a ficha já resolveu (ficha.js) e o da visão de respostas. */
export type EnderecosDaEmpregare = {
  candidato: string | null;
  vaga: string | null;
  vagaDireta: boolean;
  respostas?: string | null;
};

/** Para onde o link leva. */
export type DestinoNaEmpregare = "respostas" | "candidato" | "vaga" | "vagas";

export type EnderecoDoAnexo = { href: string; destino: DestinoNaEmpregare };

export type ApresentacaoDoAnexo = {
  rotulo: string;
  /** Onde achar o arquivo depois de abrir. */
  dica: string;
};

/* O mesmo formato que obter_ficha_analise monta (e uma âncora opcional, para o futuro). */
const LINK_DAS_RESPOSTAS =
  /^https:\/\/corporate\.empregare\.com\/empresa\/questionarios\/imprimir\/[0-9]{1,20}\|(#[A-Za-z][A-Za-z0-9_-]{0,60})?$/;

const PERGUNTA = /^\s*pergunta ?([0-9]+) ?[-–—] ?(.*)$/i;
const limpar = (texto: unknown) =>
  String(texto ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** O link da visão de respostas da RPC (empregare.link_respostas), só no formato esperado. */
export function linkDasRespostas(empregare: unknown): string | null {
  const texto = String(
    (empregare as { link_respostas?: unknown } | null | undefined)
      ?.link_respostas ?? "",
  ).trim();
  return LINK_DAS_RESPOSTAS.test(texto) ? texto : null;
}

/** "Pergunta 4" pelo nome da coluna da Empregare ("Pergunta 4 - Anexe…"); null sem número. */
export function numeroDaPergunta(coluna: unknown): string | null {
  const m = PERGUNTA.exec(limpar(coluna));
  return m ? `Pergunta ${m[1]}` : null;
}

/** O enunciado inteiro, sem o "Pergunta N - " do começo (o "ver texto completo" da ficha). */
export function enunciadoCompleto(coluna: unknown): string {
  const texto = limpar(coluna);
  const m = PERGUNTA.exec(texto);
  return (m ? (m[2] ?? "") : texto).trim();
}

/**
 * O endereço do anexo: a visão de respostas do questionário (com os anexos);
 * sem ela, o candidato (o currículo) e, sem ele, as candidaturas da vaga ou a
 * lista de vagas.
 */
export function enderecoDoAnexo(
  enderecos: EnderecosDaEmpregare,
  _coluna?: unknown,
): EnderecoDoAnexo | null {
  if (enderecos.respostas)
    return { href: enderecos.respostas, destino: "respostas" };
  if (enderecos.candidato)
    return { href: enderecos.candidato, destino: "candidato" };
  if (enderecos.vaga)
    return {
      href: enderecos.vaga,
      destino: enderecos.vagaDireta ? "vaga" : "vagas",
    };
  return null;
}

/** O curto do enunciado para a dica (até 60 caracteres, sem cortar palavra). */
function curto(texto: string, maximo = 60): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  const espaco = corte.lastIndexOf(" ");
  return `${corte.slice(0, espaco > 20 ? espaco : maximo).trim()}…`;
}

/**
 * Rótulo e dica do anexo. Com a visão de respostas: "Ver respostas e anexos
 * na Empregare" e "Pergunta 4 — Anexe o documento…". Sem ela: "Abrir na
 * Empregare" e "Na Empregare: aba Questionários › Pergunta 4 — …".
 */
export function apresentacaoDoAnexo(
  coluna: unknown,
  endereco?: EnderecoDoAnexo | null,
): ApresentacaoDoAnexo {
  const numero = numeroDaPergunta(coluna);
  const enunciado = curto(
    enunciadoCompleto(coluna).split(/[?:(]/)[0]?.trim() ?? "",
  );
  const pergunta = [numero, enunciado].filter(Boolean).join(" — ");
  if (endereco?.destino === "respostas")
    return { rotulo: "Ver respostas e anexos na Empregare", dica: pergunta };
  return {
    rotulo: "Abrir na Empregare",
    dica: pergunta
      ? `Na Empregare: aba Questionários › ${pergunta}`
      : "Na Empregare: aba Questionários",
  };
}
