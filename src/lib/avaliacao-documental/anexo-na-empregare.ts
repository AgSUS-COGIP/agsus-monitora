/*
  O anexo declarado na Empregare, como a ficha o mostra: o endereço do botão
  do anexo, o rótulo e a dica de onde achar o arquivo. Única fonte: a ficha
  (ficha.jsx e ficha/empregare.tsx) não monta link nenhum.

  O robô (scripts/robo-empregare/anexos_empregare.py, com --anexos) lê o
  painel de respostas de cada questionário (GetRespostaDetails) e grava
  (migration 20261008160000): por anexo, o link "Visualizar Arquivo"
  (/Company/VacancyTests/GetViewerLogArquivo?…, abre o visualizador da
  Empregare com login, não expira) com o enunciado e a coluna do Excel
  casada; por resposta, o link de impressão (/Company/VacancyTests/PrintResult?…).
  obter_ficha_analise devolve em `empregare.anexos` e `empregare.respostas`.

    enderecos.anexos = anexosDaEmpregare(dados.empregare);        // ficha.jsx
    enderecos.impressao = impressaoDasRespostas(dados.empregare);
    const endereco = enderecoDoAnexo(enderecos, coluna);           // { href, destino } | null
    const { rotulo, dica } = apresentacaoDoAnexo(coluna, endereco);
  destino "arquivo" → "Ver documento" (sem dica; "2 arquivos nesta pergunta" com mais de um
  arquivo); "respostas" → "Ver respostas na Empregare" e a dica da pergunta;
  sem nada capturado, o candidato (o currículo) ou a vaga / a lista de vagas,
  com a dica de antes.
  Sem DOM e sem estado. Testes: tests/lib/avaliacao-documental-anexo-na-empregare.test.js.
*/

/** Um anexo capturado (obter_ficha_analise → empregare.anexos). */
export type AnexoDaEmpregare = {
  resposta: string;
  pergunta: string;
  arquivo: number;
  enunciado: string;
  coluna: string;
  link: string;
};

/** Os endereços que a ficha já resolveu (ficha.js), os anexos e a impressão das respostas. */
export type EnderecosDaEmpregare = {
  candidato: string | null;
  vaga: string | null;
  vagaDireta: boolean;
  anexos?: readonly AnexoDaEmpregare[];
  impressao?: string | null;
};

/** Para onde o link leva. */
export type DestinoNaEmpregare =
  "arquivo" | "respostas" | "candidato" | "vaga" | "vagas";

export type EnderecoDoAnexo = {
  href: string;
  destino: DestinoNaEmpregare;
  /** Os outros arquivos da mesma pergunta (só no destino "arquivo"). */
  outros?: readonly string[];
};

export type ApresentacaoDoAnexo = {
  rotulo: string;
  /** Onde achar o arquivo depois de abrir (vazio quando o link já é o arquivo). */
  dica: string;
};

/* Os mesmos formatos que o banco aceita (CK_EMPREGANEXO_DSLINK, CK_EMPREGRESP_DSLINKIMPRESSAO) e o robô confere. */
const LINK_DO_ARQUIVO =
  /^https:\/\/corporate\.empregare\.com\/Company\/VacancyTests\/GetViewerLogArquivo\?[A-Za-z0-9_.~=&%|+/:-]+$/;
const LINK_DA_IMPRESSAO =
  /^https:\/\/corporate\.empregare\.com\/Company\/VacancyTests\/PrintResult\?[A-Za-z0-9_.~=&%|+/:-]+$/;
const TAMANHO_DO_LINK = 1500;

const PERGUNTA = /^\s*pergunta ?([0-9]+) ?[-–—] ?(.*)$/i;
const limpar = (texto: unknown) =>
  String(texto ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
/* Como normalizarTexto de nota-declarada.js, sem o "Pergunta N - " do começo. */
const comparavel = (texto: unknown) =>
  limpar(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^pergunta ?[0-9]+ ?[-–—] ?/, "");

const linkValido = (padrao: RegExp, link: unknown) => {
  const texto = String(link ?? "").trim();
  return texto.length <= TAMANHO_DO_LINK && padrao.test(texto) ? texto : null;
};

/** Os anexos da RPC (empregare.anexos), validados; o resto fica de fora. */
export function anexosDaEmpregare(empregare: unknown): AnexoDaEmpregare[] {
  const bruto = (empregare as { anexos?: unknown } | null | undefined)?.anexos;
  if (!Array.isArray(bruto)) return [];
  const saida: AnexoDaEmpregare[] = [];
  for (const item of bruto as Record<string, unknown>[]) {
    const link = linkValido(LINK_DO_ARQUIVO, item?.link);
    const pergunta = String(item?.pergunta ?? "");
    if (!link || !/^[0-9]{1,20}$/.test(pergunta)) continue;
    saida.push({
      resposta: String(item.resposta ?? ""),
      pergunta,
      arquivo: Number(item.arquivo) || 1,
      enunciado: limpar(item.enunciado),
      coluna: limpar(item.coluna),
      link,
    });
  }
  return saida;
}

/** O link de impressão da primeira resposta com ele (empregare.respostas), ou null. */
export function impressaoDasRespostas(empregare: unknown): string | null {
  const bruto = (empregare as { respostas?: unknown } | null | undefined)
    ?.respostas;
  if (!Array.isArray(bruto)) return null;
  for (const item of bruto as Record<string, unknown>[]) {
    const link = linkValido(LINK_DA_IMPRESSAO, item?.link_impressao);
    if (link) return link;
  }
  return null;
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
 * Os anexos da coluna: os da coluna do Excel que o robô casou; sem ela, os de
 * enunciado igual — ou um começando pelo outro, com 20+ letras — numa única pergunta.
 */
export function anexosDaColuna(
  anexos: readonly AnexoDaEmpregare[] | undefined,
  coluna: unknown,
): AnexoDaEmpregare[] {
  if (!anexos?.length) return [];
  const alvo = limpar(coluna);
  const pelaColuna = anexos.filter((a) => a.coluna && a.coluna === alvo);
  if (pelaColuna.length) return pelaColuna;
  const enunciado = comparavel(coluna);
  if (enunciado.length < 5) return [];
  const casa = (a: AnexoDaEmpregare) => {
    const e = comparavel(a.enunciado);
    if (e === enunciado) return true;
    return (
      e.length >= 20 &&
      enunciado.length >= 20 &&
      (e.startsWith(enunciado) || enunciado.startsWith(e))
    );
  };
  const achados = anexos.filter(casa);
  const perguntas = new Set(achados.map((a) => `${a.resposta}:${a.pergunta}`));
  return perguntas.size === 1 ? achados : [];
}

/**
 * O endereço do anexo: o "Visualizar Arquivo" da pergunta; sem ele, a
 * impressão das respostas; sem ela, o candidato (o currículo) e, sem ele, as
 * candidaturas da vaga ou a lista de vagas.
 */
export function enderecoDoAnexo(
  enderecos: EnderecosDaEmpregare,
  coluna?: unknown,
): EnderecoDoAnexo | null {
  const arquivos = anexosDaColuna(enderecos.anexos, coluna).sort(
    (a, b) => a.arquivo - b.arquivo,
  );
  const [primeiro, ...outros] = arquivos;
  if (primeiro)
    return {
      href: primeiro.link,
      destino: "arquivo",
      outros: outros.map((a) => a.link),
    };
  if (enderecos.impressao)
    return { href: enderecos.impressao, destino: "respostas" };
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
 * Rótulo e dica do anexo. Com o link do arquivo: "Ver documento" (sem dica;
 * "2 arquivos nesta pergunta" com mais de um). Com a impressão: "Ver
 * respostas na Empregare" e "Pergunta 4 — Anexe o documento…". Senão: "Abrir
 * na Empregare" e "Na Empregare: aba Questionários › Pergunta 4 — …".
 */
export function apresentacaoDoAnexo(
  coluna: unknown,
  endereco?: EnderecoDoAnexo | null,
): ApresentacaoDoAnexo {
  if (endereco?.destino === "arquivo") {
    const total = 1 + (endereco.outros?.length ?? 0);
    return {
      rotulo: "Ver documento",
      dica: total > 1 ? `${total} arquivos nesta pergunta` : "",
    };
  }
  const numero = numeroDaPergunta(coluna);
  const enunciado = curto(
    enunciadoCompleto(coluna).split(/[?:(]/)[0]?.trim() ?? "",
  );
  const pergunta = [numero, enunciado].filter(Boolean).join(" — ");
  if (endereco?.destino === "respostas")
    return { rotulo: "Ver respostas na Empregare", dica: pergunta };
  return {
    rotulo: "Abrir na Empregare",
    dica: pergunta
      ? `Na Empregare: aba Questionários › ${pergunta}`
      : "Na Empregare: aba Questionários",
  };
}
