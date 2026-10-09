/*
  O anexo declarado na Empregare, como a ficha o mostra: o endereço do botão
  do anexo, o rótulo e a dica de onde achar o arquivo. Única fonte: a ficha
  (ficha.jsx e ficha/empregare.tsx) não monta link nenhum.

  O robô (scripts/robo-empregare/anexos_empregare.py, com --anexos) lê o
  JSON das respostas de cada questionário (GetRespostaDetails) e grava
  (migration 20261008160000): por anexo, o link "Visualizar Arquivo"
  (/Company/VacancyTests/GetViewerLogArquivo?…, abre o visualizador da
  Empregare com login, não expira) com a Ordem, o enunciado e a coluna do
  Excel casada (pela Ordem, confirmada pelo enunciado); por resposta, o link de impressão (/Company/VacancyTests/PrintResult?…).
  obter_ficha_analise devolve em `empregare.anexos` e `empregare.respostas` só os
  da resposta vigente (a mais nova com pergunta lida — 20261009210000); quem
  respondeu o questionário mais de uma vez tem as outras em
  `empregare.envios_anteriores`, cada uma com os arquivos.

    enderecos.anexos = anexosDaEmpregare(dados.empregare);        // ficha.jsx
    enderecos.impressao = impressaoDasRespostas(dados.empregare);
    enderecos.anteriores = enviosAnterioresDaEmpregare(dados.empregare);
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
  /** A Ordem da pergunta no questionário (o "Pergunta N" da exportação), ou null. */
  ordem: number | null;
  enunciado: string;
  coluna: string;
  link: string;
};

/** Um envio anterior do questionário (obter_ficha_analise → empregare.envios_anteriores). */
export type EnvioAnterior = {
  resposta: string;
  /** A impressão das respostas desse envio, ou null. */
  impressao: string | null;
  arquivos: AnexoDaEmpregare[];
};

/** Os endereços que a ficha já resolveu (ficha.js), os anexos e a impressão das respostas. */
export type EnderecosDaEmpregare = {
  candidato: string | null;
  vaga: string | null;
  vagaDireta: boolean;
  /** Só os da resposta vigente do questionário. */
  anexos?: readonly AnexoDaEmpregare[];
  impressao?: string | null;
  /** As outras respostas ao questionário, da mais nova para a mais antiga. */
  anteriores?: readonly EnvioAnterior[];
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
/*
  O enunciado para casar (a mesma regra de chave_do_enunciado no robô): sem
  "Pergunta N - ", tags, entidades, acentos, caixa e TUDO que não for letra ou
  dígito — "Nível Superior: (frente" e "Nivel Superior:(frente" dão a mesma
  chave. Casam iguais ou um prefixo do outro no tamanho do menor, com pelo
  menos MINIMO_DO_PREFIXO caracteres (a coluna do Excel vem truncada).
*/
export const MINIMO_DO_PREFIXO = 20;
const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  "#160": " ",
};
export function chaveDoEnunciado(texto: unknown): string {
  return String(texto ?? "")
    .replace(/<[^>]{0,500}>/g, " ")
    .replace(
      /&(nbsp|amp|lt|gt|quot|#39|#160);/gi,
      (_, e: string) => ENTIDADES[e.toLowerCase()] ?? " ",
    )
    .replace(/^\s*pergunta\s*[0-9]+\s*[-–—]\s*/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
export function enunciadosCasam(a: string, b: string): boolean {
  if (!a || !b) return false;
  const menor = Math.min(a.length, b.length);
  if (a === b) return menor >= 5;
  return menor >= MINIMO_DO_PREFIXO && a.slice(0, menor) === b.slice(0, menor);
}

const linkValido = (padrao: RegExp, link: unknown) => {
  const texto = String(link ?? "").trim();
  return texto.length <= TAMANHO_DO_LINK && padrao.test(texto) ? texto : null;
};

/** Uma lista de anexos da RPC, validados; o resto fica de fora. */
function anexosValidos(bruto: unknown, resposta?: string): AnexoDaEmpregare[] {
  if (!Array.isArray(bruto)) return [];
  const saida: AnexoDaEmpregare[] = [];
  for (const item of bruto as Record<string, unknown>[]) {
    const link = linkValido(LINK_DO_ARQUIVO, item?.link);
    const pergunta = String(item?.pergunta ?? "");
    if (!link || !/^[0-9]{1,20}$/.test(pergunta)) continue;
    saida.push({
      resposta: resposta ?? String(item.resposta ?? ""),
      pergunta,
      arquivo: Number(item.arquivo) || 1,
      ordem: Number.isInteger(item.ordem) ? (item.ordem as number) : null,
      enunciado: limpar(item.enunciado),
      coluna: limpar(item.coluna),
      link,
    });
  }
  return saida;
}

/** Os anexos da resposta vigente (empregare.anexos), validados; o resto fica de fora. */
export function anexosDaEmpregare(empregare: unknown): AnexoDaEmpregare[] {
  return anexosValidos(
    (empregare as { anexos?: unknown } | null | undefined)?.anexos,
  );
}

/** Os envios anteriores do questionário (empregare.envios_anteriores), validados, na ordem da RPC. */
export function enviosAnterioresDaEmpregare(
  empregare: unknown,
): EnvioAnterior[] {
  const bruto = (
    empregare as { envios_anteriores?: unknown } | null | undefined
  )?.envios_anteriores;
  if (!Array.isArray(bruto)) return [];
  const saida: EnvioAnterior[] = [];
  for (const item of bruto as Record<string, unknown>[]) {
    const resposta = String(item?.resposta ?? "");
    if (!/^[0-9]{1,20}$/.test(resposta)) continue;
    saida.push({
      resposta,
      impressao: linkValido(LINK_DA_IMPRESSAO, item.link_impressao),
      arquivos: anexosValidos(item.arquivos, resposta),
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
 * Os anexos da coluna: os da coluna do Excel que o robô casou; sem ela, os da
 * Ordem = N de "Pergunta N" com o enunciado confirmando (enunciadosCasam); senão
 * os de enunciado que casa, numa única pergunta.
 */
export function anexosDaColuna(
  anexos: readonly AnexoDaEmpregare[] | undefined,
  coluna: unknown,
): AnexoDaEmpregare[] {
  if (!anexos?.length) return [];
  const alvo = limpar(coluna);
  const pelaColuna = anexos.filter((a) => a.coluna && a.coluna === alvo);
  if (pelaColuna.length) return pelaColuna;
  const chave = chaveDoEnunciado(coluna);
  if (!chave) return [];
  const casa = (a: AnexoDaEmpregare) =>
    enunciadosCasam(chave, chaveDoEnunciado(a.enunciado));
  const umaPergunta = (lista: AnexoDaEmpregare[]) =>
    new Set(lista.map((a) => `${a.resposta}:${a.pergunta}`)).size === 1;
  const n = Number(PERGUNTA.exec(alvo)?.[1]);
  if (n) {
    const pelaOrdem = anexos.filter((a) => a.ordem === n && casa(a));
    if (pelaOrdem.length && umaPergunta(pelaOrdem)) return pelaOrdem;
  }
  const achados = anexos.filter(casa);
  return umaPergunta(achados) ? achados : [];
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
