/*
  O link de cada ANEXO declarado na Empregare, como a ficha o mostra.

  O robô (scripts/robo-empregare/anexos_empregare.py, com --anexos) lê a aba
  Questionários de cada candidato e grava por pergunta de anexo
  (TB_EMPREGARE_ANEXO, migration 20261008160000): o link do próprio arquivo
  (tipo ARQUIVO) ou, se o arquivo exige sessão ou expira, o da página do
  questionário com âncora (tipo QUESTIONARIO). obter_ficha_analise devolve em
  `empregare.anexos`: [{ pergunta, enunciado, tipo, link, capturado_em }].

  Para a tela (a ficha não monta link nenhum):
    const anexos = anexosDaEmpregare(dados.empregare);          // valida o que veio da RPC
    const enderecos = { candidato, vaga, vagaDireta, anexos };   // os da ficha + os anexos
    const endereco = enderecoDoAnexo(enderecos, linha.coluna);   // { href, destino } | null
    const { rotulo, dica } = apresentacaoDoAnexo(linha.coluna, endereco);
  destino "arquivo" → "Ver documento", sem dica; "questionario" → "Abrir na
  Empregare" + "aba Questionários › Pergunta N"; sem anexo capturado, o
  candidato (o currículo) ou a vaga, como antes, com a mesma dica.
  Mesmo formato (tipos e nomes) de anexo-na-empregare.ts do redesenho da
  ficha (feat/ficha-de-analise-redesenho): lá, basta importar daqui e passar
  `anexos` em `enderecos` e o `endereco` para apresentacaoDoAnexo.
  Sem DOM e sem estado. Testes: tests/link-do-anexo.test.js.
*/

/** Um anexo capturado pelo robô (obter_ficha_analise → empregare.anexos). */
export type AnexoDaEmpregare = {
  pergunta: number;
  enunciado: string;
  tipo: "ARQUIVO" | "QUESTIONARIO";
  link: string;
  capturadoEm: string | null;
};

/** Os endereços que a ficha já resolveu (ficha.js) e os anexos capturados. */
export type EnderecosDaEmpregare = {
  candidato: string | null;
  vaga: string | null;
  vagaDireta: boolean;
  anexos?: readonly AnexoDaEmpregare[];
};

/** Para onde o link leva. */
export type DestinoNaEmpregare =
  "arquivo" | "questionario" | "candidato" | "vaga" | "vagas";

export type EnderecoDoAnexo = { href: string; destino: DestinoNaEmpregare };

export type ApresentacaoDoAnexo = {
  rotulo: string;
  /** Onde achar o arquivo depois de abrir (vazio quando o link já é o arquivo). */
  dica: string;
};

/* Os mesmos formatos que o banco aceita (CK_EMPREGANEXO_DSLINK) e o robô confere. */
const LINK_DO_ARQUIVO =
  /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?\/[^\s"'<>`\\]*$/;
const LINK_DA_PAGINA =
  /^https:\/\/corporate\.empregare\.com\/[A-Za-z0-9_.~=&%|+/:?#-]*$/;
const TAMANHO_DO_LINK = 1000;

const PERGUNTA = /^\s*pergunta ?([0-9]+) ?[-–—] ?(.*)$/i;
const limpar = (texto: unknown) =>
  String(texto ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
const comparavel = (texto: unknown) =>
  limpar(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O link do anexo só se estiver no formato do tipo (o banco já confere; aqui, defesa da tela). */
export function linkValido(tipo: unknown, link: unknown): string | null {
  const texto = String(link ?? "").trim();
  if (!texto || texto.length > TAMANHO_DO_LINK) return null;
  if (tipo === "ARQUIVO") return LINK_DO_ARQUIVO.test(texto) ? texto : null;
  if (tipo === "QUESTIONARIO") return LINK_DA_PAGINA.test(texto) ? texto : null;
  return null;
}

/** Os anexos da RPC (empregare.anexos), validados e por pergunta; o resto fica de fora. */
export function anexosDaEmpregare(empregare: unknown): AnexoDaEmpregare[] {
  const bruto = (empregare as { anexos?: unknown } | null | undefined)?.anexos;
  if (!Array.isArray(bruto)) return [];
  const porPergunta = new Map<number, AnexoDaEmpregare>();
  for (const item of bruto as Record<string, unknown>[]) {
    const pergunta = Number(item?.pergunta);
    const tipo = item?.tipo;
    const link = linkValido(tipo, item?.link);
    if (!Number.isInteger(pergunta) || pergunta < 1 || pergunta > 999 || !link)
      continue;
    if (porPergunta.has(pergunta)) continue;
    porPergunta.set(pergunta, {
      pergunta,
      enunciado: limpar(item.enunciado),
      tipo: tipo as AnexoDaEmpregare["tipo"],
      link,
      capturadoEm:
        typeof item.capturado_em === "string" ? item.capturado_em : null,
    });
  }
  return [...porPergunta.values()].sort((a, b) => a.pergunta - b.pergunta);
}

/** "Pergunta 4" pelo nome da coluna da Empregare ("Pergunta 4 - Anexe…"); null sem número. */
export function numeroDaPergunta(coluna: unknown): string | null {
  const m = PERGUNTA.exec(limpar(coluna));
  return m ? `Pergunta ${m[1]}` : null;
}

/** O enunciado inteiro, sem o "Pergunta N - " do começo. */
export function enunciadoCompleto(coluna: unknown): string {
  const texto = limpar(coluna);
  const m = PERGUNTA.exec(texto);
  return (m ? (m[2] ?? "") : texto).trim();
}

/**
 * O anexo capturado da coluna: pelo número da pergunta ("Pergunta 4 - …");
 * sem número (ou sem anexo com ele), pelo enunciado igual — ou um começando
 * pelo outro, com ao menos 20 letras.
 */
export function anexoDaColuna(
  anexos: readonly AnexoDaEmpregare[] | undefined,
  coluna: unknown,
): AnexoDaEmpregare | null {
  if (!anexos?.length) return null;
  const m = PERGUNTA.exec(limpar(coluna));
  if (m) {
    const porNumero = anexos.find((a) => a.pergunta === Number(m[1]));
    if (porNumero) return porNumero;
  }
  const alvo = comparavel(enunciadoCompleto(coluna));
  if (alvo.length < 20) return null;
  return (
    anexos.find((a) => {
      const e = comparavel(a.enunciado);
      return (
        e.length >= 20 &&
        (e === alvo || e.startsWith(alvo) || alvo.startsWith(e))
      );
    }) ?? null
  );
}

/**
 * O endereço do anexo: o arquivo ou a página do questionário capturados;
 * sem eles, o candidato (o currículo, onde fica a aba Questionários) e, sem
 * ele, as candidaturas da vaga ou a lista de vagas.
 */
export function enderecoDoAnexo(
  enderecos: EnderecosDaEmpregare,
  coluna?: unknown,
): EnderecoDoAnexo | null {
  const anexo = anexoDaColuna(enderecos.anexos, coluna);
  if (anexo)
    return {
      href: anexo.link,
      destino: anexo.tipo === "ARQUIVO" ? "arquivo" : "questionario",
    };
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
 * Rótulo e dica do anexo. Com o link do arquivo: "Ver documento", sem dica.
 * Senão: "Abrir na Empregare" e "Na Empregare: aba Questionários › Pergunta
 * 4 — Anexe o documento de identificação…".
 */
export function apresentacaoDoAnexo(
  coluna: unknown,
  endereco?: EnderecoDoAnexo | null,
): ApresentacaoDoAnexo {
  if (endereco?.destino === "arquivo")
    return { rotulo: "Ver documento", dica: "" };
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
