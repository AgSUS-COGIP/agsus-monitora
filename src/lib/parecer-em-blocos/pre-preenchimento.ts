/* Parecer em blocos: pré-preenchimento com o que o MONITORA sabe (API pública em ../parecer-em-blocos.ts). */

import { TITULOS_POR_NIVEL } from "./catalogos.ts";
import type { NivelDaVaga } from "./catalogos.ts";
import { referenciasDoEdital } from "./etapas-e-referencias.ts";
import type { RegraParaOParecer } from "./etapas-e-referencias.ts";
import { texto, totalSemSobreposicao } from "./meses-e-formatacao.ts";
import { blocoDo, novaExperiencia, rascunhoVazio } from "./rascunho.ts";
import type { Assinatura, Decisao, RascunhoDoParecer } from "./rascunho.ts";

// ── Pré-preenchimento com o que o MONITORA sabe ──────────────────────────

export type FonteDoCampo =
  "recurso" | "cronograma" | "ficha" | "ajuste" | "regras" | "calculado";

export const ROTULO_DA_FONTE: Readonly<Record<FonteDoCampo, string>> =
  Object.freeze({
    recurso: "do recurso",
    cronograma: "do cronograma",
    ficha: "da ficha",
    ajuste: "do ajuste",
    regras: "das Regras do edital",
    calculado: "calculado",
  });

/** O recorte da ficha concluída que o parecer lê (obter_ficha_analise). */
export interface FichaParaOParecer {
  nivel?: string | null;
  modalidades?: readonly string[];
  indigena?: boolean;
  mora_aldeia?: boolean;
  blocos: readonly {
    codigo: string;
    tipo: string;
    titulo?: string;
    situacao: string;
    efeito?: string | null;
    motivos?: readonly string[];
  }[];
  titulos?: readonly {
    titulo?: string;
    aceito?: boolean;
    motivo?: string | null;
  }[];
  vinculos?: readonly {
    empregador?: string;
    categoria?: string;
    inicio?: string;
    fim?: string;
    aceito?: boolean;
    motivo?: string | null;
  }[];
  /** Os meses que a ficha apurou (apurarExperiencia: dias ÷ 30, une o dia seguinte). */
  meses_apurados?: number | null;
}

/** Tudo o que o MONITORA tem para o parecer de um recurso (a interface da fonte de dados). */
export interface DadosParaOParecer {
  recurso: {
    id: string | number;
    candidato: string;
    codigo: string | number | null;
    edital: string;
    unidade: string;
    vaga: string;
    cargo?: string;
    processo_sei?: string | null;
    situacao?: string | null;
    /** Data e hora do envio do recurso pelo candidato (PROPOSTA: não existe; hoje só criado_em). */
    enviado_em?: string | null;
    criado_em?: string | null;
    /** A observação do recurso (get_recurso_candidato_detalhe): ponto de partida do resumo das alegações. */
    observacao?: string | null;
  };
  /** O período de interposição (a atividade de abertura do recurso no cronograma). */
  periodo?: {
    inicio: string | null;
    fim: string | null;
    atividade: string;
  } | null;
  ficha?: FichaParaOParecer | null;
  regra?: RegraParaOParecer | null;
  /** A última versão do ajuste da pontuação (proposta ou aprovada). */
  ajuste?: {
    situacao: string;
    nota_antiga: number | null;
    nota_nova: number | null;
  } | null;
  /** Diferenças do modelo de parecer da área/edital (PROPOSTA). */
  textos?: Partial<Record<string, string>> | null;
  assinaturas?: Assinatura[] | null;
}

/** Interface da fonte de dados: no protótipo, dados fictícios; depois, as RPCs. */
export interface FonteDoParecer {
  carregar(recursoId: string | number): Promise<DadosParaOParecer>;
}

const DECISAO_DA_SITUACAO: Readonly<Record<string, Decisao>> = Object.freeze({
  DEFERIDO: "DEFERIMENTO",
  PARCIALMENTE_INDEFERIDO: "DEFERIMENTO PARCIAL",
  INDEFERIDO: "INDEFERIMENTO",
});

const NIVEL_DA_FICHA: Readonly<Record<string, NivelDaVaga>> = Object.freeze({
  superior: "superior",
  tecnico: "tecnico",
  medio: "medio",
  fundamental: "fundamental",
});

/** "2026-10-21T18:40:00-03:00" → ["2026-10-21", "18:40"] no horário de Brasília. */
export function dataEHoraDeBrasilia(
  valor: string | null | undefined,
): [string, string] {
  if (!valor) return ["", ""];
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return ["", ""];
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return [
    `${partes.year}-${partes.month}-${partes.day}`,
    `${partes.hour}:${partes.minute}`,
  ];
}

const notaDoParecer = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? ""
    : n.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });

const cotaDaFicha = (ficha: FichaParaOParecer, sigla: RegExp) =>
  ficha.blocos.find(
    (b) => b.tipo === "COTA" && sigla.test(`${b.codigo} ${b.titulo ?? ""}`),
  );

const negado = (situacao: string | undefined) =>
  situacao === "NAO_CONFORME" || situacao === "NAO_ENVIADO";

/**
 * O rascunho com o que o MONITORA já sabe, e de onde veio cada campo (para a
 * tela marcar "da ficha", "do cronograma"…). O que não se sabe fica como no
 * simulador.
 */
export function rascunhoInicial(dados: DadosParaOParecer): {
  rascunho: RascunhoDoParecer;
  fontes: Partial<Record<string, FonteDoCampo>>;
  avisos: string[];
} {
  const r = rascunhoVazio("avaliacao");
  const fontes: Partial<Record<string, FonteDoCampo>> = {};
  const avisos: string[] = [];
  const marcar = (campo: string, fonte: FonteDoCampo) =>
    (fontes[campo] = fonte);
  const rec = dados.recurso;

  r.cabecalho = {
    processo: texto(rec.processo_sei),
    edital: texto(rec.edital),
    unidade: texto(rec.unidade),
    candidato: texto(rec.candidato),
    codigo: texto(rec.codigo),
    vaga: texto(rec.vaga),
  };
  if (texto(rec.observacao)) {
    r.alegacoes = texto(rec.observacao);
    marcar("alegacoes", "recurso");
  }
  for (const campo of Object.keys(r.cabecalho))
    if ((r.cabecalho as Record<string, string>)[campo])
      marcar(`cabecalho.${campo}`, "recurso");

  const { referencias, fontes: fontesDasRefs } = referenciasDoEdital(
    dados.regra,
  );
  r.referencias = referencias;
  for (const [chave, fonte] of Object.entries(fontesDasRefs))
    if (fonte !== "padrao") marcar(`referencias.${chave}`, "regras");

  const vinculos = dados.regra?.blocos?.find((b) => b.tipo === "VINCULOS");
  if (typeof vinculos?.pontos_por_mes === "number") {
    r.pontos_por_mes = vinculos.pontos_por_mes;
    marcar("pontos_por_mes", "regras");
  }

  if (dados.periodo?.inicio || dados.periodo?.fim) {
    r.admissibilidade.prazo_de = texto(dados.periodo.inicio);
    r.admissibilidade.prazo_ate = texto(
      dados.periodo.fim ?? dados.periodo.inicio,
    );
    marcar("admissibilidade.prazo", "cronograma");
  } else avisos.push("O período de recurso não foi encontrado no cronograma.");

  const envio = rec.enviado_em || rec.criado_em || "";
  const [dia, hora] = dataEHoraDeBrasilia(envio);
  if (dia) {
    r.admissibilidade.envio_data = dia;
    r.admissibilidade.envio_hora = hora;
    marcar("admissibilidade.envio", "recurso");
    if (!rec.enviado_em)
      avisos.push(
        "Sem a data de envio do candidato: usada a data do cadastro do recurso.",
      );
  }
  const { prazo_de, prazo_ate } = r.admissibilidade;
  if (dia && prazo_ate) {
    const tempestivo = (!prazo_de || dia >= prazo_de) && dia <= prazo_ate;
    r.admissibilidade.tempestivo = tempestivo;
    r.admissibilidade.atende_periodo = tempestivo;
    marcar("admissibilidade.tempestivo", "calculado");
    if (!tempestivo) r.conclusao.decisao = "INDEFERIMENTO";
  }

  const decisao = DECISAO_DA_SITUACAO[texto(rec.situacao)];
  if (decisao) {
    r.conclusao.decisao = decisao;
    marcar("conclusao.decisao", "recurso");
  }
  if (dados.ajuste && dados.ajuste.situacao !== "CANCELADO") {
    r.conclusao.retificar = true;
    r.conclusao.nota_antiga = notaDoParecer(dados.ajuste.nota_antiga);
    r.conclusao.nota_nova = notaDoParecer(dados.ajuste.nota_nova);
    marcar("conclusao.notas", "ajuste");
  }
  if (dados.assinaturas?.length)
    r.assinaturas = dados.assinaturas.map((a) => ({
      ...a,
      lotacao: [...a.lotacao],
    }));

  const ficha = dados.ficha;
  if (!ficha) {
    avisos.push(
      "A ficha da Avaliação documental não foi encontrada: os blocos vêm em branco.",
    );
    return { rascunho: r, fontes, avisos };
  }

  // Requisitos eliminatórios: algum bloco da ficha com efeito ELIMINA.
  const requisitos = blocoDo(r, "requisitos")!;
  const eliminou = ficha.blocos.filter((b) => b.efeito === "ELIMINA");
  if (eliminou.length) {
    requisitos.atendeu = false;
    for (const b of eliminou) {
      if (/IDENT|DOC_ID|RG/i.test(b.codigo)) requisitos.identificacao = true;
      else if (b.tipo === "VINCULOS") requisitos.experiencia_minima = true;
      else if (/DIPLOMA|ESCOLAR|GRADUACAO|FORMACAO/i.test(b.codigo))
        requisitos.diploma = true;
    }
  }
  marcar("bloco.requisitos", "ficha");

  // Formação: o nível da vaga e os títulos aceitos.
  const formacao = blocoDo(r, "formacao")!;
  const nivel = NIVEL_DA_FICHA[texto(ficha.nivel).toLowerCase()];
  if (nivel) formacao.nivel = nivel;
  const blocoTitulos = ficha.blocos.find((b) => b.tipo === "TITULOS");
  const aceitos = (ficha.titulos ?? [])
    .filter((x) => x.aceito !== false)
    .map((x) => texto(x.titulo));
  if (
    blocoTitulos?.situacao === "NAO_ENVIADO" ||
    (!aceitos.length && !(ficha.titulos ?? []).length)
  )
    formacao.situacao = "nao_apresentada";
  else if (blocoTitulos?.situacao === "NAO_CONFORME" && !aceitos.length)
    formacao.situacao = "invalidada";
  else {
    formacao.situacao = "comprovada";
    formacao.titulos = (TITULOS_POR_NIVEL[formacao.nivel] ?? [])
      .filter((x) => x.daFicha.some((t) => aceitos.includes(t)))
      .map((x) => x.id);
  }
  marcar("bloco.formacao", "ficha");

  // Experiência: um item por vínculo, com as datas; recusado = Não atende.
  const experiencia = blocoDo(r, "experiencia")!;
  const vinculosDaFicha = ficha.vinculos ?? [];
  if (vinculosDaFicha.length) {
    experiencia.itens = vinculosDaFicha.map((x) =>
      novaExperiencia({
        atende: x.aceito !== false,
        empresa: texto(x.empregador),
        inicio: texto(x.inicio),
        fim: texto(x.fim),
        ...(x.aceito === false && x.motivo
          ? { motivo_da_ficha: texto(x.motivo) }
          : {}),
      }),
    );
    marcar("bloco.experiencia", "ficha");
    const meses = totalSemSobreposicao(
      experiencia.itens,
      r.pontos_por_mes,
    ).meses;
    if (
      typeof ficha.meses_apurados === "number" &&
      ficha.meses_apurados !== meses
    )
      avisos.push(
        `A ficha apurou ${ficha.meses_apurados} ${ficha.meses_apurados === 1 ? "mês" : "meses"} (dias ÷ 30); o parecer conta ${meses} ${meses === 1 ? "mês completo" : "meses completos"}, como o simulador.`,
      );
  }

  // Cotas e pertencimento: só os blocos que a ficha negou ficam marcados.
  const modalidades = (ficha.modalidades ?? []).map((m) => m.toUpperCase());
  const pcd = blocoDo(r, "pcd")!;
  const cotaPcd = cotaDaFicha(ficha, /PCD|DEFICI/i);
  if (negado(cotaPcd?.situacao)) {
    pcd.marcado = true;
    pcd.opcao =
      cotaPcd!.situacao === "NAO_ENVIADO" ? "sem_documento" : "em_desacordo";
    marcar("bloco.pcd", "ficha");
  }
  const indigena = blocoDo(r, "indigena")!;
  const etnico = ficha.blocos.find((b) => b.tipo === "PONTUACAO");
  const pontosEtnicos = dados.regra?.blocos?.find(
    (b) => b.tipo === "PONTUACAO",
  );
  if (pontosEtnicos && typeof pontosEtnicos.indigena === "number") {
    indigena.no_recurso_pontos = String(
      pontosEtnicos.indigena + (pontosEtnicos.aldeia ?? 0),
    );
  }
  if (ficha.indigena && etnico) {
    if (negado(etnico.situacao)) indigena.sem_documento = true;
    if (ficha.mora_aldeia && etnico.efeito === "SEM_PONTOS_ALDEIA")
      indigena.aldeia = true;
    marcar("bloco.indigena", "ficha");
  }
  const quilombola = blocoDo(r, "quilombola")!;
  const cotaQuilombola = cotaDaFicha(ficha, /QUILOMB/i);
  if (negado(cotaQuilombola?.situacao)) {
    quilombola.marcado = true;
    marcar("bloco.quilombola", "ficha");
  }
  const hetero = blocoDo(r, "heteroidentificacao")!;
  const cotaNegros = cotaDaFicha(ficha, /NEGR|PRET|PARD|PPP|HETERO/i);
  if (negado(cotaNegros?.situacao)) {
    hetero.marcado = true;
    marcar("bloco.heteroidentificacao", "ficha");
  }

  // Bloco de cota sem a cota na inscrição sai do parecer (o analista pode pôr de volta).
  const optou = (re: RegExp) => modalidades.some((m) => re.test(m));
  r.blocos = r.blocos.filter((b) => {
    if (b.codigo === "pcd") return optou(/PCD|DEFIC/) || pcd.marcado;
    if (b.codigo === "quilombola")
      return optou(/QUILOMB/) || quilombola.marcado;
    if (b.codigo === "heteroidentificacao")
      return optou(/NEGR|PRET|PARD|PPP/) || hetero.marcado;
    if (b.codigo === "indigena")
      return Boolean(ficha.indigena) || optou(/INDIG/);
    return true;
  });
  return { rascunho: r, fontes, avisos };
}

/**
 * O período de interposição do recurso no cronograma: a atividade de
 * ABERTURA (prazo de recurso) da origem, a de fim mais tardio. É a mesma
 * classificação de prazo-do-recurso.ts.
 */
export function periodoDeInterposicao(
  etapas: readonly {
    atividade: string;
    inicio: string | null;
    fim: string | null;
    origem: string | null;
    papel: string | null;
  }[],
  origem: string,
): { inicio: string | null; fim: string | null; atividade: string } | null {
  const daOrigem = etapas
    .filter(
      (e) =>
        e.papel === "abertura" && e.origem === origem && (e.fim || e.inicio),
    )
    .sort((a, b) =>
      String(a.fim ?? a.inicio).localeCompare(String(b.fim ?? b.inicio)),
    );
  const ultima = daOrigem.at(-1);
  return ultima
    ? { inicio: ultima.inicio, fim: ultima.fim, atividade: ultima.atividade }
    : null;
}
