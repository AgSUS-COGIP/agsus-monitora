/*
  A fila da avaliação documental (aba Fila, fase F3), sem DOM e sem estado:
  as etapas com contadores, os filtros (e o formato dos filtros salvos), a
  reserva ("Em uso por … desde HH:MM"), o que cada ação em lote pode pegar da
  seleção e o plano da distribuição (a conta é de distribuicao.js, a mesma do
  job Python). Os dados vêm de obter_fila_avaliacao
  (supabase/migrations/20261006120000_fichas_fila_e_reserva.sql).
*/
import { distribuirFichas } from "./distribuicao.js";

/** As abas de etapa, na ordem do funil; cada uma é também um filtro. */
export const ETAPAS_DA_FILA = Object.freeze([
  { valor: "inscritos", rotulo: "Inscritos" },
  { valor: "lote", rotulo: "No lote" },
  { valor: "pendentes", rotulo: "Pendentes" },
  { valor: "em_analise", rotulo: "Em análise" },
  { valor: "revisao", rotulo: "Em revisão" },
  { valor: "concluidas", rotulo: "Concluídas" },
  { valor: "eliminados", rotulo: "Eliminados" },
]);

export const SITUACOES_DA_FICHA = Object.freeze({
  PENDENTE: { rotulo: "Pendente", tom: "pendente" },
  EM_ANALISE: { rotulo: "Em análise", tom: "revisar" },
  REVISAR: { rotulo: "Em revisão", tom: "revisar" },
  CONCLUIDA: { rotulo: "Concluída", tom: "aprovado" },
  FORA_LOTE: { rotulo: "Fora do lote", tom: "reprovado" },
});

const SITUACAO_DA_ETAPA = {
  pendentes: "PENDENTE",
  em_analise: "EM_ANALISE",
  revisao: "REVISAR",
  concluidas: "CONCLUIDA",
};
const NO_LOTE = new Set(["NO_LOTE", "ANALISADO"]);

/** O inscrito está na etapa? */
export function naEtapa(c, etapa) {
  if (!c) return false;
  if (etapa === "inscritos" || !etapa) return true;
  if (etapa === "lote") return NO_LOTE.has(c.situacao_pre);
  if (etapa === "eliminados") return c.situacao_pre === "ELIMINADO";
  const situacao = SITUACAO_DA_ETAPA[etapa];
  return Boolean(situacao) && c.ficha?.situacao === situacao;
}

/** Os contadores de cada etapa (as abas do topo). */
export function contadoresDaFila(candidatos) {
  const lista = Array.isArray(candidatos) ? candidatos : [];
  return Object.fromEntries(
    ETAPAS_DA_FILA.map(({ valor }) => [
      valor,
      lista.filter((c) => naEtapa(c, valor)).length,
    ]),
  );
}

export const FILTRO_INICIAL = Object.freeze({
  etapa: "lote",
  vaga: "",
  responsavel: "",
  modalidade: "",
  busca: "",
});

const ETAPAS_VALIDAS = new Set(ETAPAS_DA_FILA.map((e) => e.valor));
const textoCurto = (v, max) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * O filtro só com as chaves conhecidas (é o que se salva e o que se lê de
 * volta do banco ou do navegador). responsavel: "" (todos), "eu", "ninguem"
 * ou o id de um analista.
 */
export function normalizarFiltro(filtro) {
  const f = filtro && typeof filtro === "object" ? filtro : {};
  return {
    etapa: ETAPAS_VALIDAS.has(f.etapa) ? f.etapa : FILTRO_INICIAL.etapa,
    vaga: textoCurto(f.vaga, 20),
    responsavel: textoCurto(f.responsavel, 40),
    modalidade: textoCurto(f.modalidade, 10),
    busca: textoCurto(f.busca, 80),
  };
}

const semAcento = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Os inscritos que passam pelo filtro (eu = o id de quem está logado). */
export function filtrarFila(candidatos, filtro, eu = "") {
  const f = normalizarFiltro(filtro);
  const busca = semAcento(f.busca);
  return (Array.isArray(candidatos) ? candidatos : []).filter((c) => {
    if (!naEtapa(c, f.etapa)) return false;
    if (f.vaga && String(c.vaga) !== f.vaga) return false;
    if (f.modalidade && c.modalidade !== f.modalidade) return false;
    const responsavel = c.ficha?.responsavel || "";
    if (f.responsavel === "eu" && (!eu || responsavel !== eu)) return false;
    if (f.responsavel === "ninguem" && (!c.ficha || responsavel)) return false;
    if (
      f.responsavel &&
      f.responsavel !== "eu" &&
      f.responsavel !== "ninguem" &&
      responsavel !== f.responsavel
    )
      return false;
    if (
      busca &&
      !semAcento(c.codigo).includes(busca) &&
      !semAcento(c.nome).includes(busca)
    )
      return false;
    return true;
  });
}

/** O filtro é o inicial (nada a limpar)? */
export const filtroEhInicial = (filtro) =>
  JSON.stringify(normalizarFiltro(filtro)) === JSON.stringify(FILTRO_INICIAL);

/** AM-6.4: o código digitado abre direto a ficha (um inscrito com ficha e esse código). */
export function fichaPeloCodigo(candidatos, texto) {
  const codigo = String(texto ?? "").trim();
  if (!codigo) return null;
  const achados = (Array.isArray(candidatos) ? candidatos : []).filter(
    (c) => c.ficha?.id && String(c.codigo) === codigo,
  );
  return achados.length === 1 ? achados[0] : null;
}

/** A reserva ainda vale? */
export function reservaVigente(reserva, agora = new Date()) {
  if (!reserva?.expira) return false;
  const fim = new Date(reserva.expira);
  return !Number.isNaN(fim.getTime()) && fim > agora;
}

const hora = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

/** "Em uso por Ana desde 14:05" (AM-12.2) ou "Com você até 14:20"; "" sem reserva vigente. */
export function textoDaReserva(reserva, eu = "", agora = new Date()) {
  if (!reservaVigente(reserva, agora)) return "";
  if (eu && reserva.usuario === eu)
    return `Com você até ${hora(reserva.expira)}`;
  return `Em uso por ${reserva.nome || "outra pessoa"} desde ${hora(reserva.desde)}`;
}

/** O que cada ação em lote da coordenação pode pegar da seleção (inscritos com ficha). */
export function acoesDaSelecao(selecionados, agora = new Date()) {
  const fichas = (Array.isArray(selecionados) ? selecionados : []).filter(
    (c) => c?.ficha?.id,
  );
  return {
    distribuir: fichas.filter(
      (c) => !["CONCLUIDA", "FORA_LOTE"].includes(c.ficha.situacao),
    ),
    liberar: fichas.filter((c) => reservaVigente(c.ficha.reserva, agora)),
    revisao: fichas.filter((c) =>
      ["PENDENTE", "EM_ANALISE"].includes(c.ficha.situacao),
    ),
  };
}

const ordemDaProvisoria = (a, b) =>
  (a.posicao ?? Infinity) - (b.posicao ?? Infinity) ||
  String(a.vaga).localeCompare(String(b.vaga)) ||
  String(a.ficha.id).localeCompare(String(b.ficha.id));

/**
 * O plano da distribuição das fichas escolhidas (a prévia antes de gravar,
 * AM-6.2). As fichas escolhidas saem da carga de quem as tem hoje e voltam a
 * ser distribuídas na ordem da Provisória pela regra do edital.
 *   para: "" = distribuir entre a equipe; "fila" = devolver à fila; ou o id
 *         de um analista (todas para ele).
 * Devolve { atribuicoes: [{ ficha, versao, usuario }], sobra: [ids],
 *   resumo: [{ usuario, nome, novas, total }], redistribui: boolean }.
 */
export function planoDeDistribuicao(
  selecionados,
  analistas,
  distribuicao = {},
  para = "",
) {
  const fichas = (Array.isArray(selecionados) ? selecionados : [])
    .filter((c) => c?.ficha?.id)
    .sort(ordemDaProvisoria);
  const equipe = Array.isArray(analistas) ? analistas : [];
  const saindo = {};
  for (const c of fichas)
    if (
      c.ficha.responsavel &&
      ["PENDENTE", "EM_ANALISE"].includes(c.ficha.situacao)
    )
      saindo[c.ficha.responsavel] = (saindo[c.ficha.responsavel] ?? 0) + 1;
  const redistribui = fichas.some((c) => c.ficha.responsavel);
  const versao = Object.fromEntries(
    fichas.map((c) => [c.ficha.id, c.ficha.versao]),
  );

  let atribuicoes;
  let sobra = [];
  if (para === "fila") {
    atribuicoes = fichas.map((c) => ({ ficha: c.ficha.id, usuario: null }));
  } else {
    const r = distribuirFichas({
      fichas: fichas.map((c) => ({ id: c.ficha.id, vaga: c.vaga })),
      analistas: equipe
        .filter((a) => !para || a.usuario === para)
        .map((a) => ({
          ...a,
          pendentes: Math.max(0, (a.pendentes ?? 0) - (saindo[a.usuario] ?? 0)),
        })),
      criterio: para ? "PARTES_IGUAIS" : distribuicao.criterio,
      limite_por_analista: para ? null : distribuicao.limite_por_analista,
    });
    atribuicoes = r.atribuicoes;
    sobra = r.sobra;
  }
  const novas = {};
  for (const a of atribuicoes)
    if (a.usuario) novas[a.usuario] = (novas[a.usuario] ?? 0) + 1;
  const resumo = equipe
    .filter((a) => novas[a.usuario])
    .map((a) => ({
      usuario: a.usuario,
      nome: a.nome || "",
      novas: novas[a.usuario],
      total:
        Math.max(0, (a.pendentes ?? 0) - (saindo[a.usuario] ?? 0)) +
        novas[a.usuario],
    }));
  return {
    atribuicoes: atribuicoes.map((a) => ({ ...a, versao: versao[a.ficha] })),
    sobra,
    resumo,
    redistribui,
  };
}
