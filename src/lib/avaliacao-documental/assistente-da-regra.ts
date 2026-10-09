/*
  O assistente "Nova regra" / "Editar regra" da avaliação documental, em
  regras puras (sem DOM e sem estado). É uma interface sobre o MESMO JSON da
  regra (src/lib/avaliacao-documental/regra.js, schema 1): cada cartão do
  cardápio liga ou desliga um pedaço da regra (um bloco, uma eliminação
  automática, o corte pelos pontos mínimos), e o resultado é salvo como versão
  nova pelo salvar_regra_analise de sempre. Nada de formato novo.

  - Ponto de partida: a versão vigente, a regra conferida de outro edital da
    área, um modelo ou do zero. Sempre uma cópia independente.
  - Cartões: marcado traz o pedaço de volta (o que foi desmarcado nesta
    edição, ou a sugestão das fontes: o ponto de partida, os modelos e as
    regras da área, nesta ordem; sem nada parecido, o bloco vazio de
    blocoNovo). Nenhum peso mora aqui: os valores sugeridos vêm das fontes.
  - Perguntas da Empregare: cada pergunta da regra é procurada nas colunas da
    última carga de CADA vaga do edital com a mesma regra de casamento da
    nota declarada (colunasDaPergunta): achou (uma coluna por vaga), ambígua
    (mais de uma numa vaga) ou não achou.
*/
import {
  CODIGO,
  LOTE_PADRAO,
  blocoNovo,
  codigoLivre,
  normalizarRegraAnalise,
} from "./regra.js";
import { PARCIAL_DO_TIPO } from "./catalogo.js";
import {
  chaveDaOpcao,
  colunasDaPergunta,
  comecoDoEnunciado,
  normalizarTexto,
  textoDaResposta,
} from "./nota-declarada.js";
import type {
  Bloco,
  ColunasDaVaga,
  DesempateDaProvisoria,
  EliminacaoAutomatica,
  ItemDaNotaDeclarada,
  Motivo,
  Parcial,
  Pergunta,
  PerguntaDaCarga,
  RegraAnalise,
  TipoDeBloco,
} from "./tipos-da-regra.ts";

const copia = <T>(valor: T): T => structuredClone(valor);
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** A regra com os padrões onde faltam (o normalizarRegraAnalise, tipado). */
export function regraNormalizada(entrada: unknown): RegraAnalise {
  return normalizarRegraAnalise(entrada) as unknown as RegraAnalise;
}

/* ---------- 1. Ponto de partida ---------- */

export type PontoDePartida =
  | { tipo: "vigente"; versao: number; configuracao: RegraAnalise }
  | {
      tipo: "edital";
      edital: string;
      versao: number;
      configuracao: RegraAnalise;
    }
  | { tipo: "modelo"; codigo: string; configuracao: RegraAnalise }
  | { tipo: "zero" };

/**
 * A regra de onde o assistente começa, sempre uma cópia independente. De outro
 * edital: o rótulo do parecer passa a ser o deste edital e o tamanho do lote
 * por vaga sai (as vagas são de lá). De um modelo: o código do modelo fica em
 * `modelo` e, sem rótulo no modelo, entra o deste edital (como a cópia do
 * banco faz).
 */
export function regraDoPontoDePartida(
  ponto: PontoDePartida,
  { editalRotulo = "" }: { editalRotulo?: string } = {},
): RegraAnalise {
  if (ponto.tipo === "zero")
    return regraNormalizada({ modelo: null, edital_rotulo: editalRotulo });
  const base = copia(ponto.configuracao) as RegraAnalise &
    Record<string, unknown>;
  if (ponto.tipo === "vigente") return regraNormalizada(base);
  if (ponto.tipo === "edital") {
    const lote = ehObjeto(base.lote) ? { ...base.lote } : {};
    delete (lote as Record<string, unknown>).por_vaga;
    return regraNormalizada({
      ...base,
      lote,
      edital_rotulo: editalRotulo || base.edital_rotulo,
    });
  }
  return regraNormalizada({
    ...base,
    modelo: ponto.codigo,
    edital_rotulo: String(base.edital_rotulo ?? "").trim()
      ? base.edital_rotulo
      : editalRotulo,
  });
}

/** O motivo da versão que o assistente salva quando é a primeira do edital. */
export function motivoDoPontoDePartida(ponto: PontoDePartida): string {
  if (ponto.tipo === "modelo")
    return `Criada no assistente a partir do modelo ${ponto.codigo}`;
  if (ponto.tipo === "edital")
    return `Criada no assistente a partir da regra v${ponto.versao} do edital ${ponto.edital}`;
  if (ponto.tipo === "vigente")
    return `Criada no assistente a partir da versão ${ponto.versao}`;
  return "Criada no assistente, do zero";
}

/** De que área é um modelo, pelo prefixo do código (PROJ26-…, SI26-…). */
export function areaDoModelo(codigo: string): string | null {
  if (/^SI/i.test(codigo)) return "saude-indigena";
  if (/^PROJ/i.test(codigo)) return "projetos";
  return null;
}

/* ---------- 2. O cardápio ---------- */

export type GrupoDoCartao = "eliminatorios" | "pontos" | "cotas" | "inscricao";

/* "Na inscrição" vem primeiro: o que elimina antes da análise (inscrição cancelada, questionário, Empregare, termo, pontos mínimos). */
export const GRUPOS_DO_CARDAPIO: ReadonlyArray<[GrupoDoCartao, string]> =
  Object.freeze([
    ["inscricao", "Na inscrição"],
    ["eliminatorios", "Requisitos que eliminam"],
    ["pontos", "O que vale ponto"],
    ["cotas", "Cotas"],
  ]);

type DefinicaoDoBloco = {
  tipo: TipoDeBloco;
  codigo: string;
  titulo: string;
  condicao?: string;
  motivo?: string;
};

export type Cartao = {
  id: string;
  grupo: GrupoDoCartao;
  rotulo: string;
  /** Palavras do enunciado para achar a pergunta da Empregare (sem acento). */
  palavras: string[];
  marcado: boolean;
  bloco?: DefinicaoDoBloco;
  eliminacao?: EliminacaoAutomatica;
  corte?: true;
  area?: string;
  /** Não está no catálogo: veio da regra (bloco ou eliminação próprios). */
  proprio?: boolean;
};

type DefinicaoDoCartao = Omit<Cartao, "marcado">;

const doc = (
  codigo: string,
  rotulo: string,
  titulo: string,
  motivo: string,
  palavras: string[],
): DefinicaoDoCartao => ({
  id: `bloco:${codigo}`,
  grupo: "eliminatorios",
  rotulo,
  palavras,
  bloco: { tipo: "DOCUMENTO", codigo, titulo, motivo },
});
const pontos = (
  tipo: TipoDeBloco,
  codigo: string,
  rotulo: string,
  titulo: string,
  palavras: string[],
  area?: string,
): DefinicaoDoCartao => ({
  id: `bloco:${codigo}`,
  grupo: "pontos",
  rotulo,
  palavras,
  bloco: { tipo, codigo, titulo },
  ...(area ? { area } : {}),
});
const cota = (
  codigo: string,
  modalidade: string,
  rotulo: string,
  palavras: string[],
): DefinicaoDoCartao => ({
  id: `bloco:${codigo}`,
  grupo: "cotas",
  rotulo,
  palavras,
  bloco: {
    tipo: "COTA",
    codigo,
    titulo: rotulo,
    condicao: `MODALIDADE=${modalidade}`,
  },
});
const elimina = (
  eliminacao: EliminacaoAutomatica,
  rotulo: string,
  palavras: string[] = [],
): DefinicaoDoCartao => ({
  id: `eliminacao:${eliminacao.codigo}`,
  grupo: "inscricao",
  rotulo,
  palavras,
  eliminacao,
});

/*
  O catálogo do cardápio. Só a ESTRUTURA (que bloco, que coluna da Empregare):
  pontos, tetos e faixas vêm das fontes (ponto de partida, modelos, regras da
  área) ou ficam em zero.
*/
export const CATALOGO_DO_CARDAPIO: ReadonlyArray<DefinicaoDoCartao> =
  Object.freeze([
    doc(
      "IDENTIDADE",
      "Documento de identificação",
      "Documento de identificação oficial com foto",
      "Documento de identificação ilegível ou fora da lista do edital.",
      ["documento de identificacao"],
    ),
    doc(
      "ESCOLARIDADE",
      "Formação exigida pela vaga",
      "Formação exigida pela vaga (diploma ou certificado)",
      "Não comprovou a formação exigida para a vaga.",
      ["comprovacao de nivel", "graduacao", "ensino medio"],
    ),
    doc(
      "REGISTRO_CONSELHO",
      "Registro no conselho de classe",
      "Registro ativo no conselho de classe, quando exigido",
      "Não apresentou registro ativo no conselho de classe.",
      ["registro profissional"],
    ),
    pontos(
      "PONTUACAO",
      "ETNICO",
      "Critério étnico (indígena e aldeia)",
      "Critério étnico",
      ["indigena e mora em aldeia", "voce e indigena"],
      "saude-indigena",
    ),
    pontos(
      "TITULOS",
      "FORMACAO",
      "Titulação acadêmica",
      "Titulação acadêmica",
      ["titulacao academica"],
    ),
    pontos(
      "CURSOS",
      "CURSOS",
      "Cursos de aperfeiçoamento",
      "Cursos de aperfeiçoamento",
      ["cursos"],
    ),
    pontos(
      "VINCULOS",
      "EXPERIENCIA",
      "Experiência profissional",
      "Experiência profissional",
      ["experiencia profissional"],
    ),
    cota("COTA_PP", "PP", "Pretos e pardos", ["pretos ou pardos"]),
    cota("COTA_PCD", "PCD", "Pessoa com deficiência", ["pcd"]),
    cota("COTA_PI", "PI", "Indígenas (cota)", ["se declaram indigenas"]),
    cota("COTA_PQ", "PQ", "Quilombolas", ["quilombolas"]),
    elimina(
      {
        codigo: "CANCELADO",
        coluna: "SITUAÇÃO",
        quando: ["CANCELADO"],
        motivo: "Cancelou a inscrição",
      },
      "Inscrição cancelada elimina",
    ),
    elimina(
      {
        codigo: "QUESTIONARIO",
        coluna_prefixo: "SITUAÇÃO - ",
        quando: [],
        exceto: ["FINALIZADO"],
        motivo: "Não finalizou o questionário",
      },
      "Questionário não finalizado elimina",
    ),
    elimina(
      {
        codigo: "REPROVADO_EMPREGARE",
        coluna: "REPROVADO",
        quando: ["SIM"],
        motivo: "Reprovado na Empregare",
      },
      "Reprovado na Empregare elimina",
    ),
    elimina(
      {
        codigo: "TERMO",
        pergunta: "",
        quando: ["Não estou de acordo"],
        motivo: "Recusou o termo de responsabilidade",
      },
      "Termo de responsabilidade recusado elimina",
      ["termo de responsabilidade", "declaro"],
    ),
    {
      id: "corte",
      grupo: "inscricao",
      rotulo: "Corte por pontos mínimos (nota declarada)",
      palavras: [],
      corte: true,
    },
  ]);

const ORDEM_DO_TIPO: Record<TipoDeBloco, number> = {
  DOCUMENTO: 0,
  REGISTRO: 1,
  PONTUACAO: 2,
  COTA: 3,
  TITULOS: 4,
  CURSOS: 5,
  VINCULOS: 6,
};
const GRUPO_DO_TIPO: Record<TipoDeBloco, GrupoDoCartao> = {
  DOCUMENTO: "eliminatorios",
  REGISTRO: "eliminatorios",
  PONTUACAO: "pontos",
  COTA: "cotas",
  TITULOS: "pontos",
  CURSOS: "pontos",
  VINCULOS: "pontos",
};
const pontua = (tipo: TipoDeBloco) =>
  Boolean((PARCIAL_DO_TIPO as Record<string, string>)[tipo]);

/** O bloco da regra que o cartão representa (o tipo que pontua é único; a cota vai pela modalidade). */
export function indiceDoBloco(
  regra: RegraAnalise,
  def: DefinicaoDoBloco,
): number {
  const blocos = regra.blocos ?? [];
  if (pontua(def.tipo)) return blocos.findIndex((b) => b.tipo === def.tipo);
  if (def.tipo === "COTA") {
    const i = blocos.findIndex(
      (b) => b.tipo === "COTA" && b.condicao === def.condicao,
    );
    if (i >= 0) return i;
  }
  return blocos.findIndex((b) => b.codigo === def.codigo);
}

const indiceDaEliminacao = (regra: RegraAnalise, codigo: string) =>
  regra.provisoria.eliminacao_automatica.findIndex((e) => e.codigo === codigo);

const cartaoMarcado = (regra: RegraAnalise, def: DefinicaoDoCartao) => {
  if (def.bloco) return indiceDoBloco(regra, def.bloco) >= 0;
  if (def.eliminacao)
    return indiceDaEliminacao(regra, def.eliminacao.codigo) >= 0;
  return regra.lote.base === "NOTA_MINIMA";
};

/** O que foi desmarcado nesta edição, para voltar igual ao marcar de novo. */
export type Guardados = Readonly<Record<string, unknown>>;

/**
 * Os cartões do cardápio para a regra: os do catálogo (o critério étnico só na
 * Saúde Indígena, ou quando a regra já tem) e os blocos e eliminações próprios
 * da regra, marcados; os próprios desmarcados nesta edição continuam na lista.
 */
export function cartoesDaRegra(
  regra: RegraAnalise,
  { area = "", guardados = {} }: { area?: string; guardados?: Guardados } = {},
): Cartao[] {
  const cartoes: Cartao[] = [];
  const blocosVistos = new Set<number>();
  const eliminacoesVistas = new Set<string>();
  for (const def of CATALOGO_DO_CARDAPIO) {
    const marcado = cartaoMarcado(regra, def);
    if (def.area && def.area !== area && !marcado) continue;
    if (def.bloco) {
      const i = indiceDoBloco(regra, def.bloco);
      if (i >= 0) blocosVistos.add(i);
    }
    if (def.eliminacao) eliminacoesVistas.add(def.eliminacao.codigo);
    cartoes.push({ ...def, marcado });
  }
  regra.blocos.forEach((b, i) => {
    if (blocosVistos.has(i)) return;
    cartoes.push({
      id: `bloco:${b.codigo}`,
      grupo: GRUPO_DO_TIPO[b.tipo] ?? "eliminatorios",
      rotulo: b.titulo || b.codigo,
      palavras: [],
      marcado: true,
      proprio: true,
      bloco: { tipo: b.tipo, codigo: b.codigo, titulo: b.titulo },
    });
  });
  for (const e of regra.provisoria.eliminacao_automatica) {
    if (eliminacoesVistas.has(e.codigo)) continue;
    eliminacoesVistas.add(e.codigo);
    cartoes.push({
      id: `eliminacao:${e.codigo}`,
      grupo: "inscricao",
      rotulo: e.motivo || e.codigo,
      palavras: [],
      marcado: true,
      proprio: true,
      eliminacao: e,
    });
  }
  const ids = new Set(cartoes.map((c) => c.id));
  for (const [id, guardado] of Object.entries(guardados)) {
    if (ids.has(id) || !ehObjeto(guardado)) continue;
    const g = guardado as Record<string, unknown>;
    if (id.startsWith("bloco:") && typeof g.tipo === "string")
      cartoes.push({
        id,
        grupo: GRUPO_DO_TIPO[g.tipo as TipoDeBloco] ?? "eliminatorios",
        rotulo: String(g.titulo || g.codigo),
        palavras: [],
        marcado: false,
        proprio: true,
        bloco: {
          tipo: g.tipo as TipoDeBloco,
          codigo: String(g.codigo),
          titulo: String(g.titulo ?? ""),
        },
      });
    else if (id.startsWith("eliminacao:"))
      cartoes.push({
        id,
        grupo: "inscricao",
        rotulo: String(g.motivo || g.codigo),
        palavras: [],
        marcado: false,
        proprio: true,
        eliminacao: g as unknown as EliminacaoAutomatica,
      });
  }
  return cartoes;
}

/** O bloco do cartão na regra (ou null). */
export function blocoDoCartao(
  regra: RegraAnalise,
  cartao: Cartao,
): Bloco | null {
  if (!cartao.bloco) return null;
  return regra.blocos[indiceDoBloco(regra, cartao.bloco)] ?? null;
}

/** A eliminação do cartão na regra (ou null). */
export function eliminacaoDoCartao(
  regra: RegraAnalise,
  cartao: Cartao,
): EliminacaoAutomatica | null {
  if (!cartao.eliminacao) return null;
  return (
    regra.provisoria.eliminacao_automatica[
      indiceDaEliminacao(regra, cartao.eliminacao.codigo)
    ] ?? null
  );
}

function blocoPadrao(def: DefinicaoDoBloco, usados: Bloco[]): Bloco {
  const codigo = usados.some((b) => b.codigo === def.codigo)
    ? codigoLivre(usados, def.codigo)
    : def.codigo;
  const novo = blocoNovo(def.tipo, codigo) as unknown as Bloco;
  novo.titulo = def.titulo;
  if (def.tipo === "COTA" && def.condicao) {
    novo.condicao = def.condicao;
    const modalidade = def.condicao.split("=")[1];
    novo.efeitos = {
      CONFORME:
        modalidade === "PP"
          ? "ENCAMINHA_HETEROIDENTIFICACAO"
          : modalidade === "PCD"
            ? "ENCAMINHA_PERICIA"
            : "SO_REGISTRO",
      NAO_CONFORME: "SEGUE_AMPLA",
      NAO_ENVIADO: "SEGUE_AMPLA",
    };
  }
  if (def.motivo)
    novo.motivos = [
      { codigo: "NAO_COMPROVADO", texto: def.motivo, item_edital: "" },
    ];
  return novo;
}

/** A sugestão de um bloco: o parecido da primeira fonte que tiver, senão o padrão. */
export function sugestaoDoBloco(
  def: DefinicaoDoBloco,
  fontes: ReadonlyArray<RegraAnalise>,
  usados: Bloco[] = [],
): Bloco {
  for (const fonte of fontes) {
    const regra = regraNormalizada(fonte);
    const achado = regra.blocos[indiceDoBloco(regra, def)];
    if (achado) {
      const bloco = copia(achado);
      if (
        bloco.codigo !== def.codigo &&
        usados.some((b) => b.codigo === bloco.codigo)
      )
        bloco.codigo = codigoLivre(usados, def.codigo);
      return bloco;
    }
  }
  return blocoPadrao(def, usados);
}

function sugestaoDaEliminacao(
  modelo: EliminacaoAutomatica,
  fontes: ReadonlyArray<RegraAnalise>,
): EliminacaoAutomatica {
  for (const fonte of fontes) {
    const achada = regraNormalizada(
      fonte,
    ).provisoria.eliminacao_automatica.find((e) => e.codigo === modelo.codigo);
    if (achada) return copia(achada);
  }
  return copia(modelo);
}

/* Onde entra um bloco novo: depois do último do mesmo tipo ou de tipo anterior. */
function inserirBloco(blocos: Bloco[], bloco: Bloco): Bloco[] {
  const ordem = ORDEM_DO_TIPO[bloco.tipo] ?? 99;
  let posicao = 0;
  blocos.forEach((b, i) => {
    if ((ORDEM_DO_TIPO[b.tipo] ?? 99) <= ordem) posicao = i + 1;
  });
  return [...blocos.slice(0, posicao), bloco, ...blocos.slice(posicao)];
}

const POSICAO_NO_CATALOGO = new Map(
  CATALOGO_DO_CARDAPIO.filter((d) => d.eliminacao).map((d, i) => [
    d.eliminacao?.codigo ?? "",
    i,
  ]),
);
function inserirEliminacao(
  lista: EliminacaoAutomatica[],
  nova: EliminacaoAutomatica,
): EliminacaoAutomatica[] {
  const ordem = POSICAO_NO_CATALOGO.get(nova.codigo);
  if (ordem === undefined) return [...lista, nova];
  let posicao = 0;
  lista.forEach((e, i) => {
    const o = POSICAO_NO_CATALOGO.get(e.codigo);
    if (o !== undefined && o <= ordem) posicao = i + 1;
  });
  return [...lista.slice(0, posicao), nova, ...lista.slice(posicao)];
}

export type ContextoDoCardapio = {
  fontes?: ReadonlyArray<RegraAnalise>;
  guardados?: Guardados;
  /** A nota mínima da regra de classificação (sugestão do corte). */
  notaMinima?: number | null;
};

/**
 * Marca ou desmarca um cartão. Desmarcar guarda o pedaço (para voltar igual);
 * marcar traz o guardado ou a sugestão das fontes. Devolve a regra nova e os
 * guardados novos; não muda as entradas.
 */
export function alternarCartao(
  regra: RegraAnalise,
  cartao: Cartao,
  marcar: boolean,
  { fontes = [], guardados = {}, notaMinima = null }: ContextoDoCardapio = {},
): { regra: RegraAnalise; guardados: Guardados } {
  const nova = copia(regra);
  const guardadosNovos: Record<string, unknown> = { ...guardados };
  if (cartao.bloco) {
    const i = indiceDoBloco(nova, cartao.bloco);
    if (!marcar) {
      if (i < 0) return { regra, guardados };
      guardadosNovos[cartao.id] = nova.blocos[i];
      nova.blocos = nova.blocos.filter((_, j) => j !== i);
    } else {
      if (i >= 0) return { regra, guardados };
      const guardado = guardados[cartao.id];
      const bloco = ehObjeto(guardado)
        ? (copia(guardado) as unknown as Bloco)
        : sugestaoDoBloco(cartao.bloco, fontes, nova.blocos);
      nova.blocos = inserirBloco(nova.blocos, bloco);
      delete guardadosNovos[cartao.id];
    }
  } else if (cartao.eliminacao) {
    const lista = nova.provisoria.eliminacao_automatica;
    const i = indiceDaEliminacao(nova, cartao.eliminacao.codigo);
    if (!marcar) {
      if (i < 0) return { regra, guardados };
      guardadosNovos[cartao.id] = lista[i];
      nova.provisoria.eliminacao_automatica = lista.filter((_, j) => j !== i);
    } else {
      if (i >= 0) return { regra, guardados };
      const guardado = guardados[cartao.id];
      const eliminacao = ehObjeto(guardado)
        ? (copia(guardado) as unknown as EliminacaoAutomatica)
        : sugestaoDaEliminacao(cartao.eliminacao, fontes);
      nova.provisoria.eliminacao_automatica = inserirEliminacao(
        lista,
        eliminacao,
      );
      delete guardadosNovos[cartao.id];
    }
  } else if (cartao.corte) {
    if (!marcar) {
      if (nova.lote.base !== "NOTA_MINIMA") return { regra, guardados };
      guardadosNovos.corte = {
        nota_minima: nova.lote.nota_minima ?? null,
        item_edital: nova.lote.item_edital ?? null,
      };
      nova.lote = {
        ...nova.lote,
        base: "MULTIPLO_VAGAS",
        multiplo: nova.lote.multiplo ?? LOTE_PADRAO.multiplo,
      };
    } else {
      if (nova.lote.base === "NOTA_MINIMA") return { regra, guardados };
      const g = ehObjeto(guardados.corte)
        ? (guardados.corte as { nota_minima?: number; item_edital?: string })
        : {};
      nova.lote = {
        ...nova.lote,
        base: "NOTA_MINIMA",
        nota_minima:
          g.nota_minima ?? nova.lote.nota_minima ?? notaMinima ?? null,
        item_edital:
          g.item_edital ??
          nova.lote.item_edital ??
          (nova.corte.item_edital || null),
      };
      nova.provisoria.base_da_nota = nova.provisoria.nota_declarada.length
        ? "DECLARADA"
        : "ART";
      delete guardadosNovos.corte;
    }
  }
  return { regra: nova, guardados: guardadosNovos };
}

/** Troca o bloco do cartão (o campo editado no cartão aberto). */
export function comBloco(
  regra: RegraAnalise,
  cartao: Cartao,
  bloco: Bloco,
): RegraAnalise {
  if (!cartao.bloco) return regra;
  const i = indiceDoBloco(regra, cartao.bloco);
  if (i < 0) return regra;
  const nova = copia(regra);
  nova.blocos[i] = copia(bloco);
  return nova;
}

/** Troca a eliminação do cartão. */
export function comEliminacao(
  regra: RegraAnalise,
  cartao: Cartao,
  eliminacao: EliminacaoAutomatica,
): RegraAnalise {
  if (!cartao.eliminacao) return regra;
  const i = indiceDaEliminacao(regra, cartao.eliminacao.codigo);
  if (i < 0) return regra;
  const nova = copia(regra);
  nova.provisoria.eliminacao_automatica[i] = copia(eliminacao);
  return nova;
}

/** Um documento eliminatório a mais (código livre, título para preencher). */
export function comDocumentoNovo(regra: RegraAnalise): RegraAnalise {
  const nova = copia(regra);
  const bloco = blocoNovo(
    "DOCUMENTO",
    codigoLivre(nova.blocos, "DOCUMENTO"),
  ) as unknown as Bloco;
  bloco.titulo = "Documento";
  nova.blocos = inserirBloco(nova.blocos, bloco);
  return nova;
}

/** Um código de motivo a partir do texto ("Sem frente e verso" → SEM_FRENTE_E_VERSO). */
export function codigoDoTexto(texto: string, usados: string[] = []): string {
  const base =
    normalizarTexto(texto)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^([0-9])/, "M_$1")
      .slice(0, 26) || "MOTIVO";
  const limpo = base.length < 2 ? `${base}_X` : base;
  let codigo = limpo;
  for (let n = 2; usados.includes(codigo) || !CODIGO.test(codigo); n += 1)
    codigo = `${limpo.slice(0, 26)}_${n}`;
  return codigo;
}

/** Um motivo novo do bloco, com código tirado do texto. */
export function motivoNovo(bloco: Bloco, texto = "Motivo"): Motivo {
  return {
    codigo: codigoDoTexto(
      texto,
      (bloco.motivos ?? []).map((m) => m.codigo),
    ),
    texto,
    item_edital: "",
  };
}

/* ---------- 3. Perguntas da Empregare ---------- */

export type SituacaoDaPergunta =
  "achou" | "ambigua" | "nao_achou" | "vazia" | "sem_carga";

export type ResultadoDaPergunta = {
  situacao: SituacaoDaPergunta;
  /** Vagas com a carga lida. */
  vagas: number;
  /** Vagas em que achou exatamente uma coluna. */
  comUma: number;
  /** Vagas em que casou com mais de uma coluna, e quais. */
  ambiguas: { vaga: string; colunas: string[] }[];
  /** As colunas achadas (sem repetir), para mostrar. */
  colunas: string[];
};

const temTexto = (pergunta: Pergunta | null | undefined) =>
  Array.isArray(pergunta)
    ? pergunta.some((t) => String(t).trim())
    : Boolean(String(pergunta ?? "").trim());

/**
 * Onde a pergunta da regra cai nas colunas de cada vaga, com a mesma regra da
 * nota declarada e da ficha (colunasDaPergunta): verde (uma coluna em cada
 * vaga onde aparece), amarelo (mais de uma numa vaga: a pré-classificação não
 * usa nenhuma) e vermelho (nenhuma vaga tem).
 */
export function situacaoDaPergunta(
  pergunta: Pergunta | null | undefined,
  vagas: ReadonlyArray<ColunasDaVaga>,
): ResultadoDaPergunta {
  const resultado: ResultadoDaPergunta = {
    situacao: "vazia",
    vagas: vagas.length,
    comUma: 0,
    ambiguas: [],
    colunas: [],
  };
  if (!temTexto(pergunta)) return resultado;
  if (!vagas.length) return { ...resultado, situacao: "sem_carga" };
  const achadas = new Set<string>();
  for (const vaga of vagas) {
    const respostas = Object.fromEntries(vaga.colunas.map((c) => [c, ""]));
    const colunas = colunasDaPergunta(respostas, pergunta) as string[];
    colunas.forEach((c) => achadas.add(c));
    if (colunas.length === 1) resultado.comUma += 1;
    else if (colunas.length > 1)
      resultado.ambiguas.push({ vaga: vaga.vaga, colunas });
  }
  resultado.colunas = [...achadas];
  resultado.situacao = resultado.ambiguas.length
    ? "ambigua"
    : resultado.comUma
      ? "achou"
      : "nao_achou";
  return resultado;
}

const numeroDaColuna = (coluna: string) => {
  const m = /^\s*pergunta\s*(\d+)/i.exec(coluna);
  return m ? Number(m[1]) : 9999;
};

export type OpcaoDePergunta = {
  /** O começo do enunciado, que vai para a regra. */
  texto: string;
  /** Em quantas vagas a pergunta aparece. */
  vagas: number;
  /** Uma coluna de exemplo (o enunciado inteiro). */
  coluna: string;
};

/** As perguntas da carga, sem repetir (pelo começo do enunciado), para escolher numa lista. */
export function opcoesDePerguntas(
  vagas: ReadonlyArray<ColunasDaVaga>,
): OpcaoDePergunta[] {
  const porTexto = new Map<
    string,
    OpcaoDePergunta & { numero: number; emVagas: Set<string> }
  >();
  for (const vaga of vagas)
    for (const coluna of vaga.colunas) {
      if (!/^\s*pergunta\s*\d+/i.test(coluna)) continue;
      const texto = comecoDoEnunciado(coluna);
      const chave = normalizarTexto(texto);
      if (!chave) continue;
      const atual = porTexto.get(chave) ?? {
        texto,
        coluna,
        vagas: 0,
        numero: numeroDaColuna(coluna),
        emVagas: new Set<string>(),
      };
      atual.emVagas.add(vaga.vaga);
      atual.vagas = atual.emVagas.size;
      atual.numero = Math.min(atual.numero, numeroDaColuna(coluna));
      porTexto.set(chave, atual);
    }
  return [...porTexto.values()]
    .sort((a, b) => a.numero - b.numero || a.texto.localeCompare(b.texto))
    .map(({ texto, vagas: n, coluna }) => ({ texto, vagas: n, coluna }));
}

/** As perguntas da carga cujo enunciado contém alguma das palavras do cartão. */
export function sugerirPerguntas(
  palavras: ReadonlyArray<string>,
  vagas: ReadonlyArray<ColunasDaVaga>,
): OpcaoDePergunta[] {
  const alvos = palavras.map(normalizarTexto).filter(Boolean);
  if (!alvos.length) return [];
  return opcoesDePerguntas(vagas).filter((o) => {
    const enunciado = normalizarTexto(o.coluna);
    return alvos.some((a) => enunciado.includes(a));
  });
}

export type GrupoDaLigacao =
  "bloco" | "declarada" | "experiencia" | "eliminacao";

export type Ligacao = {
  id: string;
  grupo: GrupoDaLigacao;
  /** O dono da pergunta na regra (o bloco, a parcial…). */
  rotulo: string;
  pergunta: Pergunta | null;
  codigo?: string;
  indice?: number;
};

const ROTULO_DA_PARCIAL: Record<Parcial, string> = {
  ETNICO: "Critério étnico",
  FORMACAO: "Titulação",
  CURSOS: "Cursos",
  EXPERIENCIA: "Experiência",
};

/** Toda pergunta da Empregare que a regra usa, uma por linha (o bloco sem pergunta aparece vazio). */
export function ligacoesDaRegra(regra: RegraAnalise): Ligacao[] {
  const ligacoes: Ligacao[] = [];
  for (const b of regra.blocos) {
    const perguntas = b.perguntas ?? [];
    perguntas.forEach((pergunta, indice) =>
      ligacoes.push({
        id: `bloco:${b.codigo}:${indice}`,
        grupo: "bloco",
        rotulo: b.titulo || b.codigo,
        pergunta,
        codigo: b.codigo,
        indice,
      }),
    );
    if (!perguntas.length)
      ligacoes.push({
        id: `bloco:${b.codigo}:novo`,
        grupo: "bloco",
        rotulo: b.titulo || b.codigo,
        pergunta: null,
        codigo: b.codigo,
      });
  }
  regra.provisoria.nota_declarada.forEach((item, indice) =>
    ligacoes.push({
      id: `declarada:${indice}`,
      grupo: "declarada",
      rotulo: `Nota declarada · ${ROTULO_DA_PARCIAL[item.parcial] ?? item.parcial}`,
      pergunta: item.pergunta,
      indice,
    }),
  );
  if (
    regra.provisoria.desempate.includes("EXPERIENCIA_DECLARADA") ||
    temTexto(regra.provisoria.pergunta_experiencia)
  )
    ligacoes.push({
      id: "experiencia",
      grupo: "experiencia",
      rotulo: "Desempate · experiência declarada",
      pergunta: regra.provisoria.pergunta_experiencia,
    });
  for (const e of regra.provisoria.eliminacao_automatica)
    if (e.pergunta !== undefined)
      ligacoes.push({
        id: `eliminacao:${e.codigo}`,
        grupo: "eliminacao",
        rotulo: e.motivo || e.codigo,
        pergunta: e.pergunta,
        codigo: e.codigo,
      });
  return ligacoes;
}

/**
 * Liga (ou troca) a pergunta de uma linha. No bloco, `null` tira a pergunta
 * e `adicionar` põe mais uma (o bloco aceita várias: anexos e variações).
 */
export function comPergunta(
  regra: RegraAnalise,
  ligacao: Ligacao,
  pergunta: Pergunta | null,
  { adicionar = false }: { adicionar?: boolean } = {},
): RegraAnalise {
  const nova = copia(regra);
  if (ligacao.grupo === "bloco") {
    const bloco = nova.blocos.find((b) => b.codigo === ligacao.codigo);
    if (!bloco) return regra;
    const lista = [...(bloco.perguntas ?? [])];
    const texto = Array.isArray(pergunta) ? pergunta[0] : pergunta;
    if (adicionar || ligacao.indice === undefined) {
      if (texto && !lista.includes(texto)) lista.push(texto);
    } else if (texto) lista[ligacao.indice] = texto;
    else lista.splice(ligacao.indice, 1);
    bloco.perguntas = lista;
  } else if (ligacao.grupo === "declarada" && ligacao.indice !== undefined) {
    const item = nova.provisoria.nota_declarada[ligacao.indice];
    if (!item) return regra;
    item.pergunta = pergunta ?? "";
  } else if (ligacao.grupo === "experiencia") {
    nova.provisoria.pergunta_experiencia = pergunta;
  } else if (ligacao.grupo === "eliminacao") {
    const e = nova.provisoria.eliminacao_automatica.find(
      (x) => x.codigo === ligacao.codigo,
    );
    if (!e) return regra;
    e.pergunta = Array.isArray(pergunta)
      ? (pergunta[0] ?? "")
      : (pergunta ?? "");
  }
  return nova;
}

/**
 * Liga sozinho, pelo enunciado, o que ainda não tem pergunta: o bloco do
 * catálogo sem pergunta recebe as perguntas da carga com as palavras do
 * cartão (até 4); a eliminação pelo termo, a primeira que casar. Não mexe no
 * que já está ligado.
 */
export function ligarAutomaticamente(
  regra: RegraAnalise,
  vagas: ReadonlyArray<ColunasDaVaga>,
): { regra: RegraAnalise; ligadas: number } {
  if (!vagas.length) return { regra, ligadas: 0 };
  const nova = copia(regra);
  let ligadas = 0;
  for (const def of CATALOGO_DO_CARDAPIO) {
    if (!def.palavras.length) continue;
    if (def.bloco) {
      const bloco = nova.blocos[indiceDoBloco(nova, def.bloco)];
      if (!bloco || (bloco.perguntas ?? []).length) continue;
      const achadas = sugerirPerguntas(def.palavras, vagas)
        .slice(0, 4)
        .map((o) => o.texto);
      if (achadas.length) {
        bloco.perguntas = achadas;
        ligadas += achadas.length;
      }
    } else if (def.eliminacao) {
      const e = nova.provisoria.eliminacao_automatica.find(
        (x) => x.codigo === def.eliminacao?.codigo,
      );
      if (!e || e.pergunta === undefined || temTexto(e.pergunta)) continue;
      const achada = sugerirPerguntas(def.palavras, vagas)[0];
      if (achada) {
        e.pergunta = achada.texto;
        ligadas += 1;
      }
    }
  }
  return { regra: ligadas ? nova : regra, ligadas };
}

/* ---------- Nota declarada (as respostas da inscrição que valem pontos) ---------- */

export const ORDEM_DAS_PARCIAIS: ReadonlyArray<Parcial> = Object.freeze([
  "ETNICO",
  "FORMACAO",
  "CURSOS",
  "EXPERIENCIA",
]);

const ehAnexo = (texto: string) => /^anexe\b/.test(normalizarTexto(texto));

/** A parcial de cada bloco que pontua presente na regra, na ordem. */
export function parciaisDaRegra(regra: RegraAnalise): Parcial[] {
  const tipos = new Set(regra.blocos.map((b) => b.tipo));
  return ORDEM_DAS_PARCIAIS.filter((p) =>
    Object.entries(PARCIAL_DO_TIPO).some(
      ([tipo, parcial]) => parcial === p && tipos.has(tipo as TipoDeBloco),
    ),
  );
}

/** Os itens da nota declarada de uma parcial (índices na regra). */
export function itensDaDeclarada(
  regra: RegraAnalise,
  parcial: Parcial,
): number[] {
  return regra.provisoria.nota_declarada
    .map((item, i) => (item.parcial === parcial ? i : -1))
    .filter((i) => i >= 0);
}

/** As respostas encontradas na carga para a pergunta (somadas entre as colunas que casam). */
export function respostasDaPergunta(
  pergunta: Pergunta | null | undefined,
  perguntasDaCarga: ReadonlyArray<PerguntaDaCarga>,
): { valor: string; quantidade: number }[] {
  if (!temTexto(pergunta)) return [];
  const colunas = new Set(
    colunasDaPergunta(
      Object.fromEntries(perguntasDaCarga.map((p) => [p.coluna, ""])),
      pergunta,
    ) as string[],
  );
  const porChave = new Map<string, { valor: string; quantidade: number }>();
  for (const p of perguntasDaCarga) {
    if (!colunas.has(p.coluna)) continue;
    for (const r of p.respostas) {
      const valor = textoDaResposta(r.valor);
      const chave = chaveDaOpcao(valor);
      if (!chave) continue;
      const atual = porChave.get(chave) ?? { valor, quantidade: 0 };
      atual.quantidade += r.quantidade;
      porChave.set(chave, atual);
    }
  }
  return [...porChave.values()].sort((a, b) => b.quantidade - a.quantidade);
}

/** Alguma coluna da carga que casa com a pergunta pede dado pessoal (respostas não resumidas)? */
export function perguntaComDadoPessoal(
  pergunta: Pergunta | null | undefined,
  perguntasDaCarga: ReadonlyArray<PerguntaDaCarga>,
): boolean {
  if (!temTexto(pergunta)) return false;
  const colunas = new Set(
    colunasDaPergunta(
      Object.fromEntries(perguntasDaCarga.map((p) => [p.coluna, ""])),
      pergunta,
    ) as string[],
  );
  return perguntasDaCarga.some((p) => p.dado_pessoal && colunas.has(p.coluna));
}

/** A pergunta sugerida para a nota declarada de uma parcial: a do bloco que não é anexo. */
export function perguntaSugeridaDaParcial(
  regra: RegraAnalise,
  parcial: Parcial,
): string {
  const tipo = Object.entries(PARCIAL_DO_TIPO).find(
    ([, p]) => p === parcial,
  )?.[0];
  const bloco = regra.blocos.find((b) => b.tipo === tipo);
  return (bloco?.perguntas ?? []).find((p) => !ehAnexo(p)) ?? "";
}

/**
 * Liga ou desliga a nota declarada de uma parcial. Ligar põe um item "uma
 * opção vale pontos" com a pergunta sugerida e, se a carga trouxer respostas,
 * cada uma valendo zero (para preencher); na ordem das parciais.
 */
export function alternarDeclarada(
  regra: RegraAnalise,
  parcial: Parcial,
  ligar: boolean,
  {
    perguntasDaCarga = [],
    pergunta,
  }: {
    perguntasDaCarga?: ReadonlyArray<PerguntaDaCarga>;
    pergunta?: Pergunta;
  } = {},
): RegraAnalise {
  const nova = copia(regra);
  const lista = nova.provisoria.nota_declarada;
  if (!ligar) {
    nova.provisoria.nota_declarada = lista.filter((i) => i.parcial !== parcial);
    if (
      !nova.provisoria.nota_declarada.length &&
      nova.provisoria.base_da_nota === "DECLARADA"
    )
      nova.provisoria.base_da_nota = "ART";
    return nova;
  }
  if (lista.some((i) => i.parcial === parcial)) return regra;
  const texto = pergunta ?? perguntaSugeridaDaParcial(nova, parcial);
  const respostas = respostasDaPergunta(texto, perguntasDaCarga);
  const item: ItemDaNotaDeclarada = {
    parcial,
    pergunta: texto,
    tipo: "OPCAO",
    pontos: Object.fromEntries(respostas.map((r) => [r.valor, 0])),
  };
  const ordem = ORDEM_DAS_PARCIAIS.indexOf(parcial);
  let posicao = 0;
  lista.forEach((i, j) => {
    if (ORDEM_DAS_PARCIAIS.indexOf(i.parcial) <= ordem) posicao = j + 1;
  });
  nova.provisoria.nota_declarada = [
    ...lista.slice(0, posicao),
    item,
    ...lista.slice(posicao),
  ];
  return nova;
}

/** Troca um item da nota declarada. */
export function comItemDaDeclarada(
  regra: RegraAnalise,
  indice: number,
  item: ItemDaNotaDeclarada,
): RegraAnalise {
  if (!regra.provisoria.nota_declarada[indice]) return regra;
  const nova = copia(regra);
  nova.provisoria.nota_declarada[indice] = copia(item);
  return nova;
}

/* ---------- 4. Desempate da Provisória ---------- */

/** Move um item da lista (arrastar ou as setas), sem mudar a original. */
export function moverNaLista<T>(
  lista: ReadonlyArray<T>,
  de: number,
  para: number,
): T[] {
  const nova = [...lista];
  if (
    de < 0 ||
    de >= nova.length ||
    para < 0 ||
    para >= nova.length ||
    de === para
  )
    return nova;
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item as T);
  return nova;
}

/** Liga ou desliga um desempate da Provisória (entra no fim). */
export function comDesempateDaProvisoria(
  regra: RegraAnalise,
  desempate: ReadonlyArray<DesempateDaProvisoria>,
): RegraAnalise {
  const nova = copia(regra);
  nova.provisoria.desempate = [...desempate];
  return nova;
}
