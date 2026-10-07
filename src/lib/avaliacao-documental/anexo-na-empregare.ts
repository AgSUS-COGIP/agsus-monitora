/*
  O anexo declarado na Empregare, como a ficha o mostra: o endereço que o
  "Abrir na Empregare" usa e a dica de onde achar o arquivo lá dentro.

  Hoje o robô captura só o link de detalhes do CANDIDATO (o currículo), não o
  do arquivo; por isso o anexo abre o candidato e a ficha diz onde procurar
  ("Na Empregare: aba Questionários › Pergunta 4 — Anexe o documento…").
  Quando houver o link direto do arquivo, a troca é só em `enderecoDoAnexo`
  (e o rótulo/dica em `apresentacaoDoAnexo`): a ficha não monta link nenhum.
  Sem DOM e sem estado.
*/

/** Os endereços que a ficha já resolveu (ficha.js: enderecoDoCandidatoNaEmpregare e enderecoDaVagaNaEmpregare). */
export type EnderecosDaEmpregare = {
  candidato: string | null;
  vaga: string | null;
  vagaDireta: boolean;
};

/** Para onde o link leva: o candidato, as candidaturas da vaga ou a lista de vagas. */
export type DestinoNaEmpregare = "candidato" | "vaga" | "vagas";

export type EnderecoDoAnexo = { href: string; destino: DestinoNaEmpregare };

export type ApresentacaoDoAnexo = {
  rotulo: string;
  /** Onde achar o arquivo depois de abrir (vazio quando o link já é o arquivo). */
  dica: string;
};

const PERGUNTA = /^\s*pergunta ?([0-9]+) ?[-–—] ?(.*)$/i;
const limpar = (texto: unknown) =>
  String(texto ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

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
 * O endereço do anexo. Hoje é o do candidato (o currículo, onde fica a aba
 * Questionários); sem ele, as candidaturas da vaga ou a lista de vagas — o
 * mesmo do botão da ficha. Trocar aqui pelo link direto do arquivo.
 */
export function enderecoDoAnexo(
  enderecos: EnderecosDaEmpregare,
  _coluna?: unknown,
): EnderecoDoAnexo | null {
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
 * Rótulo e dica do anexo: "Abrir na Empregare" e "Na Empregare: aba
 * Questionários › Pergunta 4 — Anexe o documento de identificação…".
 */
export function apresentacaoDoAnexo(coluna: unknown): ApresentacaoDoAnexo {
  const numero = numeroDaPergunta(coluna);
  const enunciado = curto(
    enunciadoCompleto(coluna).split(/[?:(]/)[0]?.trim() ?? "",
  );
  const pergunta = [numero, enunciado].filter(Boolean).join(" — ");
  return {
    rotulo: "Abrir na Empregare",
    dica: pergunta
      ? `Na Empregare: aba Questionários › ${pergunta}`
      : "Na Empregare: aba Questionários",
  };
}
