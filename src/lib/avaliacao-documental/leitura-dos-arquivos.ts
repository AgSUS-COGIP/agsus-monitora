/*
  O que o robô LEU dos arquivos do candidato, como a ficha mostra e como o
  avaliador decide. A leitura (texto do PDF ou OCR, cursos, títulos,
  vínculos, alertas, resumo) é feita em Python
  (python/monitora/avaliacao_documental/leitura_de_arquivos/, workflow
  leitura-de-arquivos.yml) e gravada pronta; obter_ficha_analise devolve em
  `leituras` só as dos anexos da resposta vigente (migration 20261009220000).
  Aqui não se interpreta nada do documento: só se lê, se formata e se
  registra a decisão no lançamento da ficha.

    Lido do arquivo   uma linha por arquivo: o resumo do robô e os alertas do arquivo
    Conferência       cada item lido (certificado, título, vínculo) com Aceitar e Recusar:
                        Aceitar  vira linha do item no lançamento (titulos/cursos/
                                 vinculos), com aceito e do_arquivo = a chave do item
                        Recusar  fica em lancamento.recusas_lidas[chave] = {motivo, texto}
                      A chave é "<resposta>:<pergunta>:<arquivo>:<posição do item>";
                      o banco confere as duas (FC_VALIDAR_LEITURAS_LANCAMENTO).
  A pontuação continua a das linhas aceitas (a conta da ficha e a do banco).
  Sem DOM e sem estado. Testes: tests/lib/avaliacao-documental-leitura-dos-arquivos.test.js.
*/
import { itemCompleto } from "./ficha.ts";
import { fimDoVinculoAtual } from "./datas-do-vinculo.ts";

export type AlertaLido = { codigo: string; texto: string };

export type ItemLido = {
  tipo: "CURSO" | "TITULO" | "VINCULO" | "IDENTIDADE" | "REGISTRO";
  pagina?: number | null;
  nome_confere?: boolean | null;
  alertas?: AlertaLido[];
  // CURSO
  curso?: string | null;
  horas?: number | null;
  instituicao?: string | null;
  conclusao?: string | null;
  // TITULO
  titulo?: string | null;
  data?: string | null;
  // VINCULO
  empregador?: string | null;
  cargo?: string | null;
  inicio?: string | null;
  fim?: string | null;
  atual?: boolean;
  carga_semanal?: number | null;
  dias?: number | null;
  /** Vínculo atual (sem fim): até quando os dias foram contados (a emissão do documento). */
  dias_ate?: string | null;
  /** De onde veio dias_ate: EMISSAO (do documento), DATA_LIMITE, ARQUIVO ou LEITURA. */
  dias_ate_fonte?: string | null;
  /** Declaração sem data de saída e sem "até a presente data": não dá para saber até quando. */
  fim_nao_informado?: boolean;
  /** Declaração sem número ligado a "horas semanais"/"carga horária"/"jornada". */
  carga_nao_encontrada?: boolean;
  /** "Plantões de 12 horas": plantonista, sem carga semanal direta. */
  plantonista?: boolean;
  plantao_horas?: number | null;
  cbo?: string | null;
  documento?: string | null;
  // REGISTRO
  conselho?: string | null;
  ativo?: boolean | null;
  validade?: string | null;
};

export type LeituraDoArquivo = {
  resposta: string;
  pergunta: string;
  arquivo: number;
  situacao: "LIDO" | "ILEGIVEL" | "ERRO" | "NAO_SUPORTADO";
  metodo: "TEXTO" | "OCR" | null;
  documento: string | null;
  paginas: number | null;
  nome_confere: boolean | null;
  cpf_confere: boolean | null;
  itens: ItemLido[];
  alertas: AlertaLido[];
  resumo: string;
};

/** O anexo como a ficha o conhece (respostas-do-candidato.ts: ArquivoDoCandidato). */
export type AnexoLido = {
  resposta: string;
  pergunta: string;
  arquivo: number;
  link: string;
  nome?: string;
};

export type Recusa = { motivo: MotivoDaRecusa; texto?: string };

export type MotivoDaRecusa =
  | "FORA_DA_AREA"
  | "CARGA_NAO_COMPROVADA"
  | "NOME_DIVERGENTE"
  | "ILEGIVEL"
  | "PERIODO_SOBREPOSTO"
  | "OUTRO";

/** Os motivos curtos da recusa de um item lido (os mesmos que o banco aceita). */
export const MOTIVOS_DA_RECUSA: ReadonlyArray<
  readonly [MotivoDaRecusa, string]
> = Object.freeze([
  ["FORA_DA_AREA", "fora da área da vaga"],
  ["CARGA_NAO_COMPROVADA", "carga horária não comprovada"],
  ["NOME_DIVERGENTE", "nome divergente"],
  ["ILEGIVEL", "ilegível"],
  ["PERIODO_SOBREPOSTO", "período sobreposto"],
  ["OUTRO", "outro…"],
]);
const MOTIVOS = new Set<string>(MOTIVOS_DA_RECUSA.map(([c]) => c));
export const TAMANHO_DO_TEXTO_DA_RECUSA = 200;

export type ChaveDosItens = "titulos" | "cursos" | "vinculos";
const LISTA_DO_TIPO: Partial<Record<ItemLido["tipo"], ChaveDosItens>> = {
  CURSO: "cursos",
  TITULO: "titulos",
  VINCULO: "vinculos",
};
const ROTULO_DO_TITULO: Record<string, string> = {
  ENSINO_MEDIO: "Ensino médio",
  TECNICO: "Técnico",
  GRADUACAO: "Graduação",
  ESPECIALIZACAO: "Especialização",
  RESIDENCIA: "Residência",
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
};
const TITULOS = new Set(Object.keys(ROTULO_DO_TITULO));
const SITUACOES = new Set(["LIDO", "ILEGIVEL", "ERRO", "NAO_SUPORTADO"]);
const TIPOS = new Set(["CURSO", "TITULO", "VINCULO", "IDENTIDADE", "REGISTRO"]);
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const CHAVE = /^[0-9]{1,20}:[0-9]{1,20}:[0-9]{1,2}:[0-9]{1,3}$/;

const texto = (v: unknown, maximo = 200) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, maximo) : "";
const alertasValidos = (v: unknown): AlertaLido[] =>
  Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .filter((a) => a && /^[A-Z][A-Z0-9_]{1,29}$/.test(String(a.codigo)))
        .map((a) => ({ codigo: String(a.codigo), texto: texto(a.texto) }))
    : [];
const booleanoOuNulo = (v: unknown) => (typeof v === "boolean" ? v : null);

/** As leituras da ficha (obter_ficha_analise → leituras), validadas; o resto fica de fora. */
export function leiturasDaFicha(bruto: unknown): LeituraDoArquivo[] {
  if (!Array.isArray(bruto)) return [];
  const saida: LeituraDoArquivo[] = [];
  for (const l of bruto as Record<string, unknown>[]) {
    const resposta = String(l?.resposta ?? "");
    const pergunta = String(l?.pergunta ?? "");
    if (!/^[0-9]{1,20}$/.test(resposta) || !/^[0-9]{1,20}$/.test(pergunta))
      continue;
    if (!SITUACOES.has(String(l.situacao))) continue;
    saida.push({
      resposta,
      pergunta,
      arquivo: Number(l.arquivo) || 1,
      situacao: l.situacao as LeituraDoArquivo["situacao"],
      metodo:
        l.metodo === "TEXTO" || l.metodo === "OCR"
          ? (l.metodo as "TEXTO" | "OCR")
          : null,
      documento: texto(l.documento, 30) || null,
      paginas: Number.isFinite(l.paginas) ? Number(l.paginas) : null,
      nome_confere: booleanoOuNulo(l.nome_confere),
      cpf_confere: booleanoOuNulo(l.cpf_confere),
      itens: Array.isArray(l.itens)
        ? (l.itens as Record<string, unknown>[])
            .filter((i) => i && TIPOS.has(String(i.tipo)))
            .map(
              (i) => ({ ...i, alertas: alertasValidos(i.alertas) }) as ItemLido,
            )
        : [],
      alertas: alertasValidos(l.alertas),
      resumo: texto(l.resumo),
    });
  }
  return saida;
}

/** A leitura de um anexo (resposta, pergunta, arquivo), ou null. */
export function leituraDoAnexo(
  leituras: readonly LeituraDoArquivo[],
  anexo: Pick<AnexoLido, "resposta" | "pergunta" | "arquivo">,
): LeituraDoArquivo | null {
  return (
    leituras.find(
      (l) =>
        l.resposta === String(anexo.resposta) &&
        l.pergunta === String(anexo.pergunta) &&
        l.arquivo === Number(anexo.arquivo),
    ) ?? null
  );
}

export function chaveDoItemLido(
  leitura: Pick<LeituraDoArquivo, "resposta" | "pergunta" | "arquivo">,
  indice: number,
): string {
  return `${leitura.resposta}:${leitura.pergunta}:${leitura.arquivo}:${indice}`;
}

const ano = (iso?: string | null) =>
  iso && DATA.test(iso) ? iso.slice(0, 4) : "";
const dataCurta = (iso?: string | null) =>
  iso && DATA.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : "";
const mil = (n: number) => n.toLocaleString("pt-BR");

/** O item lido numa linha: "Enfrentamento das Arboviroses · 145 h · Fiocruz MS · 2023". */
export function textoDoItemLido(item: ItemLido): string {
  const partes: string[] = [];
  if (item.tipo === "CURSO") {
    partes.push(texto(item.curso) || "Curso sem nome");
    if (item.horas) partes.push(`${item.horas} h`);
    if (item.instituicao) partes.push(texto(item.instituicao));
    if (ano(item.conclusao)) partes.push(ano(item.conclusao));
  } else if (item.tipo === "TITULO") {
    partes.push(ROTULO_DO_TITULO[item.titulo ?? ""] ?? "Título");
    if (item.curso) partes.push(texto(item.curso));
    if (item.instituicao) partes.push(texto(item.instituicao));
    if (ano(item.data)) partes.push(ano(item.data));
  } else if (item.tipo === "VINCULO") {
    partes.push(texto(item.empregador) || "Empregador não lido");
    if (item.cargo) partes.push(texto(item.cargo));
    const inicio = dataCurta(item.inicio);
    if (item.fim)
      partes.push(
        `${inicio || "?"} a ${dataCurta(item.fim)}${item.atual ? " (atual)" : ""}`,
      );
    else if (item.atual) partes.push(`${inicio || "?"} a atual`);
    // Sem fim e sem "atual": nunca um "?" ambíguo.
    else
      partes.push(
        `${inicio ? `desde ${inicio}` : "início não lido"}, fim não informado`,
      );
    if (item.carga_semanal) partes.push(`${item.carga_semanal} h/sem`);
    else if (item.plantonista)
      partes.push(
        item.plantao_horas
          ? `plantões de ${item.plantao_horas} h`
          : "plantonista",
      );
    else if (item.carga_nao_encontrada) partes.push("carga não encontrada");
    // Atual: os dias vão até a emissão do documento ou, sem ela, até hoje (o
    // "até hoje" fica no texto, discreto, em vez de alerta).
    if (item.dias)
      partes.push(
        `${mil(item.dias)} dias` +
          (item.atual && !item.fim
            ? dataCurta(item.dias_ate)
              ? ` até ${dataCurta(item.dias_ate)}`
              : " até hoje"
            : ""),
      );
  }
  return partes.join(" · ");
}

/** Os alertas de um item lido, mais os do arquivo que valem para todos os itens dele. */
export function alertasDoItemLido(
  item: ItemLido,
  leitura: LeituraDoArquivo,
): AlertaLido[] {
  const doArquivo = leitura.alertas.filter((a) =>
    [
      "NOME_DIVERGENTE",
      "NOME_A_CONFERIR",
      "CPF_DIVERGENTE",
      "LEITURA_DUVIDOSA",
    ].includes(a.codigo),
  );
  return [...doArquivo, ...(item.alertas ?? [])];
}

type BlocoComItens = {
  codigo: string;
  tipo: string;
  categorias?: { codigo: string }[];
  /** Até quando a experiência conta (o fim das inscrições, se a regra não diz outra). */
  data_limite?: string | null;
};
const LISTA_DO_BLOCO: Record<string, ChaveDosItens | undefined> = {
  TITULOS: "titulos",
  CURSOS: "cursos",
  VINCULOS: "vinculos",
};

/** Um item lido pronto para a conferência. */
export type ItemParaConferir = {
  chave: string;
  item: ItemLido;
  leitura: LeituraDoArquivo;
  anexo: AnexoLido;
  texto: string;
  alertas: AlertaLido[];
};

/** Os itens lidos dos arquivos do bloco que viram linha (cursos, títulos ou vínculos), na ordem dos arquivos. */
export function itensParaConferir(
  bloco: BlocoComItens,
  leituras: readonly LeituraDoArquivo[],
  anexos: readonly AnexoLido[],
): ItemParaConferir[] {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  if (!lista) return [];
  const saida: ItemParaConferir[] = [];
  for (const anexo of anexos) {
    const leitura = leituraDoAnexo(leituras, anexo);
    if (!leitura || leitura.situacao !== "LIDO") continue;
    leitura.itens.forEach((item, indice) => {
      if (LISTA_DO_TIPO[item.tipo] !== lista) return;
      saida.push({
        chave: chaveDoItemLido(leitura, indice),
        item,
        leitura,
        anexo,
        texto: textoDoItemLido(item),
        alertas: alertasDoItemLido(item, leitura),
      });
    });
  }
  return saida;
}

export type LinhaLida = Record<string, unknown> & {
  aceito: boolean;
  do_arquivo: string;
  /** O avaliador corrigiu o que foi lido antes de aceitar ("lido do arquivo, corrigido"). */
  corrigido?: boolean;
};

/** A linha do lançamento que o item lido vira ao Aceitar. */
export function linhaDoItemLido(
  bloco: BlocoComItens,
  item: ItemLido,
  chave: string,
): LinhaLida | null {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  if (!lista || LISTA_DO_TIPO[item.tipo] !== lista) return null;
  if (lista === "cursos")
    return {
      nome: texto(item.curso || item.instituicao),
      horas: item.horas && item.horas > 0 ? item.horas : "",
      aceito: true,
      do_arquivo: chave,
    };
  if (lista === "titulos") {
    if (!TITULOS.has(item.titulo ?? "")) return null;
    return {
      titulo: item.titulo,
      nome: [texto(item.curso), texto(item.instituicao)]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 200),
      aceito: true,
      do_arquivo: chave,
    };
  }
  return {
    empregador: [texto(item.empregador), texto(item.cargo)]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 200),
    categoria: bloco.categorias?.[0]?.codigo,
    inicio: item.inicio && DATA.test(item.inicio) ? item.inicio : "",
    // Atual: até a data limite do bloco (o fim das inscrições), ou a emissão se for antes.
    fim: dataDoFim(item, bloco.data_limite),
    aceito: true,
    do_arquivo: chave,
  };
}

function dataDoFim(item: ItemLido, dataLimite?: string | null): string {
  if (item.fim && DATA.test(item.fim)) return item.fim;
  if (!item.atual) return "";
  // A data de hoje (ou a do arquivo) não é fim: só a emissão do documento comprova.
  const emissao =
    !item.dias_ate_fonte || item.dias_ate_fonte === "EMISSAO"
      ? item.dias_ate
      : null;
  if (dataLimite) return fimDoVinculoAtual({ emissao, dataLimite });
  return item.dias_ate && DATA.test(item.dias_ate) ? item.dias_ate : "";
}

/**
 * A linha que o "Corrigir" abre já preenchida: a do Aceitar; no título que o
 * robô não classificou, o título padrão do nível (o avaliador escolhe).
 */
export function linhaParaCorrigir(
  bloco: BlocoComItens,
  item: ItemLido,
  chave: string,
  tituloPadrao?: string,
): LinhaLida | null {
  const linha = linhaDoItemLido(bloco, item, chave);
  if (linha) return linha;
  if (LISTA_DO_BLOCO[bloco.tipo] !== "titulos" || item.tipo !== "TITULO")
    return null;
  return {
    titulo: tituloPadrao || "ESPECIALIZACAO",
    nome: [texto(item.curso), texto(item.instituicao)]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 200),
    aceito: true,
    do_arquivo: chave,
  };
}

/* Os campos que o avaliador corrige (o resto da linha é marca). */
const CAMPOS_DA_LINHA = [
  "titulo",
  "nome",
  "horas",
  "empregador",
  "categoria",
  "inicio",
  "fim",
] as const;

type LancamentoComLeituras = Record<string, unknown> & {
  recusas_lidas?: Record<string, Recusa>;
};

const linhas = (l: LancamentoComLeituras, lista: ChaveDosItens) =>
  Array.isArray(l[lista]) ? (l[lista] as Record<string, unknown>[]) : [];

export type EstadoDoItemLido = "PENDENTE" | "ACEITO" | "RECUSADO";

/** Aceito (há linha com do_arquivo = chave), Recusado (recusas_lidas) ou Pendente. */
export function estadoDoItemLido(
  lancamento: LancamentoComLeituras,
  bloco: BlocoComItens,
  chave: string,
): EstadoDoItemLido {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  if (lista && linhas(lancamento, lista).some((i) => i?.do_arquivo === chave))
    return "ACEITO";
  if (lancamento.recusas_lidas?.[chave]) return "RECUSADO";
  return "PENDENTE";
}

/* A linha recém-aberta e ainda vazia (a ficha abre uma ao escolher Confere): o aceito ocupa o lugar dela. */
const linhaVazia = (i: Record<string, unknown>) =>
  !i.do_arquivo &&
  !String(i.nome ?? i.empregador ?? "").trim() &&
  !(Number(i.horas) > 0) &&
  !i.inicio &&
  !i.fim &&
  !i.da_resposta;

function semRecusa(
  recusas: Record<string, Recusa> | undefined,
  chave: string,
): Record<string, Recusa> | undefined {
  if (!recusas?.[chave]) return recusas;
  const { [chave]: _tirada, ...resto } = recusas;
  return Object.keys(resto).length ? resto : undefined;
}

/** O lançamento com o item lido aceito (linha nova, sem a recusa dele). */
export function aceitarItemLido<T extends LancamentoComLeituras>(
  lancamento: T,
  bloco: BlocoComItens,
  item: ItemParaConferir,
): T {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  const linha = linhaDoItemLido(bloco, item.item, item.chave);
  if (!lista || !linha) return lancamento;
  const atuais = linhas(lancamento, lista);
  const novas = atuais.some((i) => i?.do_arquivo === item.chave)
    ? atuais
    : [...atuais.filter((i) => !linhaVazia(i)), linha];
  const saida: T = { ...lancamento, [lista]: novas };
  const recusas = semRecusa(lancamento.recusas_lidas, item.chave);
  if (recusas) saida.recusas_lidas = recusas;
  else delete saida.recusas_lidas;
  return saida;
}

/** A linha aceita do item lido (null se não foi aceito). */
export function linhaAceita(
  lancamento: LancamentoComLeituras,
  bloco: BlocoComItens,
  chave: string,
): Record<string, unknown> | null {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  if (!lista) return null;
  return linhas(lancamento, lista).find((i) => i?.do_arquivo === chave) ?? null;
}

/**
 * O lançamento com o item lido aceito COM A CORREÇÃO do avaliador: a linha
 * corrigida no lugar da lida (ou nova), marcada `corrigido` quando algum
 * campo mudou em relação ao que o robô leu; sai a recusa dele.
 */
export function aceitarItemCorrigido<T extends LancamentoComLeituras>(
  lancamento: T,
  bloco: BlocoComItens,
  item: ItemParaConferir,
  correcao: Record<string, unknown>,
): T {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  if (!lista || !CHAVE.test(item.chave)) return lancamento;
  const lida = linhaDoItemLido(bloco, item.item, item.chave);
  const campos: Record<string, unknown> = {};
  for (const c of CAMPOS_DA_LINHA) if (c in correcao) campos[c] = correcao[c];
  const corrigido =
    !lida ||
    CAMPOS_DA_LINHA.some(
      (c) => c in campos && String(campos[c] ?? "") !== String(lida[c] ?? ""),
    );
  const linha: LinhaLida = {
    ...campos,
    aceito: true,
    do_arquivo: item.chave,
    ...(corrigido ? { corrigido: true } : {}),
  };
  const atuais = linhas(lancamento, lista);
  const novas = atuais.some((i) => i?.do_arquivo === item.chave)
    ? atuais.map((i) => (i?.do_arquivo === item.chave ? linha : i))
    : [...atuais.filter((i) => !linhaVazia(i)), linha];
  const saida: T = { ...lancamento, [lista]: novas };
  const recusas = semRecusa(lancamento.recusas_lidas, item.chave);
  if (recusas) saida.recusas_lidas = recusas;
  else delete saida.recusas_lidas;
  return saida;
}

/** O lançamento com o item lido recusado (sai a linha dele, fica o motivo). */
export function recusarItemLido<T extends LancamentoComLeituras>(
  lancamento: T,
  bloco: BlocoComItens,
  chave: string,
  motivo: MotivoDaRecusa,
  textoLivre?: string,
): T {
  if (!MOTIVOS.has(motivo) || !CHAVE.test(chave)) return lancamento;
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  const saida: T = { ...lancamento };
  if (lista)
    (saida as Record<string, unknown>)[lista] = linhas(
      lancamento,
      lista,
    ).filter((i) => i?.do_arquivo !== chave);
  // Sem aparar: o campo "outro…" grava a cada tecla (o espaço do fim ainda vai virar palavra).
  const livre =
    typeof textoLivre === "string"
      ? textoLivre.slice(0, TAMANHO_DO_TEXTO_DA_RECUSA)
      : "";
  saida.recusas_lidas = {
    ...(lancamento.recusas_lidas ?? {}),
    [chave]: livre ? { motivo, texto: livre } : { motivo },
  };
  return saida;
}

/** O lançamento sem decisão sobre o item lido (volta a Pendente). */
export function desfazerDecisaoLida<T extends LancamentoComLeituras>(
  lancamento: T,
  bloco: BlocoComItens,
  chave: string,
): T {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  const saida: T = { ...lancamento };
  if (lista)
    (saida as Record<string, unknown>)[lista] = linhas(
      lancamento,
      lista,
    ).filter((i) => i?.do_arquivo !== chave);
  const recusas = semRecusa(lancamento.recusas_lidas, chave);
  if (recusas) saida.recusas_lidas = recusas;
  else delete saida.recusas_lidas;
  return saida;
}

/**
 * Os itens lidos que um "aceitar de uma vez" pode aceitar: os ainda pendentes
 * (nem aceitos nem recusados) e completos. O incompleto (curso sem carga
 * horária, vínculo sem início ou fim lido) fica pendente, como no Aceitar de
 * um item só, que abre o Corrigir.
 */
export function pendentesCompletos(
  lancamento: LancamentoComLeituras,
  bloco: BlocoComItens,
  itens: readonly ItemParaConferir[],
): ItemParaConferir[] {
  const lista = LISTA_DO_BLOCO[bloco.tipo];
  return itens.filter((i) => {
    if (estadoDoItemLido(lancamento, bloco, i.chave) !== "PENDENTE")
      return false;
    const linha = linhaDoItemLido(bloco, i.item, i.chave);
    return Boolean(lista && linha && itemCompleto(lista, linha));
  });
}

/**
 * "Aceitar todos sem alerta": os pendentes sem nenhum alerta e completos viram
 * linha (pendentesCompletos).
 */
export function aceitarTodosSemAlerta<T extends LancamentoComLeituras>(
  lancamento: T,
  bloco: BlocoComItens,
  itens: readonly ItemParaConferir[],
): T {
  return pendentesCompletos(lancamento, bloco, itens)
    .filter((i) => !i.alertas.length)
    .reduce((l, i) => aceitarItemLido(l, bloco, i), lancamento);
}

/**
 * "Conferir todos": todos os pendentes completos do bloco viram linha de uma
 * vez, com ou sem alerta — o mesmo Aceitar de cada item, no mesmo lançamento
 * (a ficha grava como no clique de um só). Não mexe no recusado nem no já
 * aceito; o incompleto fica pendente. Devolve também as chaves aceitas, para
 * o "Desfazer" (desfazerAceitos).
 */
export function conferirTodos<T extends LancamentoComLeituras>(
  lancamento: T,
  bloco: BlocoComItens,
  itens: readonly ItemParaConferir[],
): { lancamento: T; aceitos: string[] } {
  const alvo = pendentesCompletos(lancamento, bloco, itens);
  return {
    lancamento: alvo.reduce((l, i) => aceitarItemLido(l, bloco, i), lancamento),
    aceitos: alvo.map((i) => i.chave),
  };
}

/** "Desfazer" do Conferir todos: os itens aceitos naquele clique voltam a pendente. */
export function desfazerAceitos<T extends LancamentoComLeituras>(
  lancamento: T,
  bloco: BlocoComItens,
  chaves: readonly string[],
): T {
  return chaves
    .filter((c) => estadoDoItemLido(lancamento, bloco, c) === "ACEITO")
    .reduce((l, c) => desfazerDecisaoLida(l, bloco, c), lancamento);
}

/** O rótulo curto do motivo da recusa. */
export function rotuloDaRecusa(recusa: Recusa | undefined): string {
  if (!recusa) return "";
  const rotulo =
    MOTIVOS_DA_RECUSA.find(([c]) => c === recusa.motivo)?.[1] ?? "";
  const livre = recusa.texto?.trim();
  if (recusa.motivo === "OUTRO") return livre || "outro motivo";
  return livre ? `${rotulo} — ${livre}` : rotulo;
}

/** O alerta do arquivo inteiro numa linha ("O nome do candidato não aparece no documento · …"). */
export function alertasDoArquivo(leitura: LeituraDoArquivo): string {
  return leitura.alertas.map((a) => a.texto).join(" · ");
}

/* ── Os alertas de um item, resumidos ─────────────────────────────────── */

/** Os que impedem: o item provavelmente não vale (laranja). */
const ALERTAS_QUE_IMPEDEM = [
  "NOME_DIVERGENTE",
  "CPF_DIVERGENTE",
  "DOCUMENTO_ILEGIVEL",
  "PERIODO_SOBREPOSTO",
];
/* Viram texto ou selo, não alerta: o atual sem emissão ("até hoje", no texto) e o concomitante. */
const ALERTAS_EM_TEXTO = ["SEM_DATA_FIM", "PERIODO_CONCOMITANTE"];

export type AlertasResumidos = {
  /** O alerta mais importante, o único visível (null sem alerta). */
  principal: AlertaLido | null;
  /** O principal impede (nome divergente, ilegível, mesmo empregador repetido): laranja. */
  grave: boolean;
  /** Os demais, no "+N" com a dica. */
  outros: AlertaLido[];
  /** Concomitante com vínculo de outro empregador: selo neutro, sem alerta. */
  concomitante: boolean;
};

/** No máximo um alerta visível por item (o que impede primeiro); os outros no "+N". */
export function alertasResumidos(
  alertas: readonly AlertaLido[],
): AlertasResumidos {
  const visiveis = alertas.filter((a) => !ALERTAS_EM_TEXTO.includes(a.codigo));
  const ordenados = [
    ...visiveis.filter((a) => ALERTAS_QUE_IMPEDEM.includes(a.codigo)),
    ...visiveis.filter((a) => !ALERTAS_QUE_IMPEDEM.includes(a.codigo)),
  ];
  const principal = ordenados[0] ?? null;
  return {
    principal,
    grave: Boolean(principal && ALERTAS_QUE_IMPEDEM.includes(principal.codigo)),
    outros: ordenados.slice(1),
    concomitante:
      alertas.some((a) => a.codigo === "PERIODO_CONCOMITANTE") &&
      !alertas.some((a) => a.codigo === "PERIODO_SOBREPOSTO"),
  };
}

const EXTENSOES_DE_IMAGEM = /\.(?:jpe?g|png|webp|gif|bmp|heic|heif|tiff?)$/i;

/** O anexo é foto (pelo nome do arquivo)? */
export function anexoEhImagem(nome: string | null | undefined): boolean {
  return EXTENSOES_DE_IMAGEM.test(String(nome ?? "").trim());
}

/**
 * O link abre a imagem direto (dá miniatura)? Só o endereço https que termina
 * na extensão de imagem; o visualizador da Empregare (GetViewerLogArquivo)
 * pede a sessão e registra cada acesso, então não vira miniatura.
 */
export function linkDaMiniatura(
  link: string | null | undefined,
): string | null {
  try {
    const url = new URL(String(link ?? ""));
    if (url.protocol !== "https:") return null;
    if (/GetViewerLogArquivo/i.test(url.pathname)) return null;
    return EXTENSOES_DE_IMAGEM.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
}

/** A linha aceita numa linha de texto ("Hospital · 01/02/2024 a 13/10/2026"), para mostrar a correção. */
export function textoDaLinha(
  lista: ChaveDosItens,
  linha: Record<string, unknown>,
): string {
  const t = (v: unknown) => texto(typeof v === "string" ? v : "");
  if (lista === "cursos")
    return [
      t(linha.nome) || "Curso",
      Number(linha.horas) > 0 ? `${String(linha.horas)} h` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  if (lista === "titulos")
    return [ROTULO_DO_TITULO[t(linha.titulo)] ?? "Título", t(linha.nome)]
      .filter(Boolean)
      .join(" · ");
  const inicio = dataCurta(t(linha.inicio)) || "?";
  const fim = dataCurta(t(linha.fim)) || "?";
  return [t(linha.empregador) || "Empregador", `${inicio} a ${fim}`].join(
    " · ",
  );
}
