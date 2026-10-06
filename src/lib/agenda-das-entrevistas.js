/*
  A agenda das entrevistas de um edital: a regra (dias, períodos, duração,
  intervalo, pausa, bancas, ordem) e o motor que distribui os convocados da
  lista "Convocação para entrevista" pelos horários. Lógica pura, sem DOM.

  Horários são de Brasília (FUSO_DA_AGENDA), guardados como data (AAAA-MM-DD)
  e hora (HH:MM) de parede — nada é convertido de fuso.

  O formato da regra (normalizarRegraDaAgenda) é o que o banco guarda em
  TH_REGRA_AGENDA_ENTREVISTA."DS_CONFIGURACAO" e confere em
  private."FC_VALIDAR_REGRA_AGENDA" (supabase/migrations/
  20261005120000_agenda_das_entrevistas.sql): as mesmas regras de
  validarRegraDaAgenda.

  Distribuição: os horários de cada dia saem dos períodos (do início, de
  duração + intervalo em duração + intervalo, sem invadir a pausa; o primeiro
  de cada período fica livre se a regra reservar). Cada horário tem uma vaga
  por banca. Os convocados, na ordem da regra, ocupam os horários em ordem
  cronológica, banca 1, banca 2… no mesmo horário. Agrupar por cargo: um
  cargo novo começa num horário novo (nunca divide o horário com o anterior).
*/
import { gerarXlsx, MIME_XLSX } from "./classificacao/exportacao.js";

export { MIME_XLSX };
export const FUSO_DA_AGENDA = "America/Sao_Paulo";
export const VERSAO_DA_REGRA_DA_AGENDA = 1;

export const ORDENS_DA_AGENDA = Object.freeze([
  ["CLASSIFICACAO", "Classificação na convocação"],
  ["VAGA", "Vaga / cargo"],
  ["ALFABETICA", "Alfabética"],
  ["MODALIDADE", "Modalidade"],
]);
export const ORIGENS_DA_AGENDA = Object.freeze({
  GERADA: "Gerada",
  MANUAL: "Ajuste manual",
});

export const LIMITES_DA_AGENDA = Object.freeze({
  dias: 60,
  periodos: 6,
  duracao: [5, 240],
  intervalo: [0, 120],
  bancas: [1, 20],
  nomeDaBanca: 60,
});

export const REGRA_PADRAO_DA_AGENDA = Object.freeze({
  schema: VERSAO_DA_REGRA_DA_AGENDA,
  datas: Object.freeze({
    modo: "INTERVALO",
    inicio: "",
    fim: "",
    so_dias_uteis: true,
    dias: Object.freeze([]),
    excluir: Object.freeze([]),
  }),
  periodos: Object.freeze([
    Object.freeze({ inicio: "08:00", fim: "12:00" }),
    Object.freeze({ inicio: "14:00", fim: "18:00" }),
  ]),
  duracao_min: 30,
  intervalo_min: 0,
  pausa: null,
  bancas: 1,
  nomes_das_bancas: Object.freeze([]),
  ordem: "CLASSIFICACAO",
  agrupar_por_cargo: false,
  reservar_primeiro_horario: false,
  fuso: FUSO_DA_AGENDA,
});

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ── Datas e horas ─────────────────────────────────────────────────── */

export function dataValida(texto) {
  if (!RE_DATA.test(String(texto || ""))) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}
export const horaValida = (texto) => RE_HORA.test(String(texto || ""));

/** "08:30" → 510. */
export function minutos(hora) {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + m;
}
/** 510 → "08:30". */
export function hora(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const somarDias = (data, n) => {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaDaSemanaNumero = (data) => new Date(`${data}T00:00:00Z`).getUTCDay();

/** O dia de hoje no calendário de Brasília ("AAAA-MM-DD"). */
export function hojeEmBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_AGENDA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/**
 * O dia que a agenda do dia mostra primeiro: hoje, se houver entrevista;
 * senão o próximo dia com entrevista; senão o último.
 */
export function diaInicialDaAgenda(dias, hoje) {
  const ordenados = [...new Set(dias || [])].filter(Boolean).sort();
  if (!ordenados.length) return "";
  return ordenados.find((d) => d >= hoje) || ordenados.at(-1);
}

/** "2026-10-06" → "06/10/2026". */
export function dataBR(data) {
  if (!dataValida(data)) return "";
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}
const NOMES_DOS_DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "2026-10-06" → "ter, 06/10/2026". */
export function dataComDia(data) {
  return dataValida(data)
    ? `${NOMES_DOS_DIAS[diaDaSemanaNumero(data)]}, ${dataBR(data)}`
    : "";
}

/** "06/10/2026, 07/10/2026" ou "2026-10-06" por linha → { dias, invalidos }. */
export function lerDias(texto) {
  const dias = [];
  const invalidos = [];
  for (const parte of String(texto || "").split(/[\s,;]+/)) {
    if (!parte) continue;
    const br = parte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const iso = br
      ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`
      : parte;
    if (dataValida(iso)) {
      if (!dias.includes(iso)) dias.push(iso);
    } else invalidos.push(parte);
  }
  return { dias: dias.sort(), invalidos };
}
export const textoDosDias = (dias) => (dias || []).map(dataBR).join(", ");

/** 150 → "2 h 30 min". */
export function textoDaDuracao(totalMin) {
  const n = Math.max(0, Math.round(totalMin));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ── Regra ─────────────────────────────────────────────────────────── */

const inteiro = (valor, padrao) => {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : padrao;
};
const listaDeDatas = (valor) =>
  Array.isArray(valor)
    ? [...new Set(valor.map(String).filter(Boolean))].sort()
    : [];

/** A regra completa, com os padrões no que faltar (não valida). */
export function normalizarRegraDaAgenda(bruta) {
  const r = bruta && typeof bruta === "object" ? bruta : {};
  const p = REGRA_PADRAO_DA_AGENDA;
  const datas = r.datas && typeof r.datas === "object" ? r.datas : {};
  const periodos = Array.isArray(r.periodos)
    ? r.periodos.map((x) => ({
        inicio: String(x?.inicio || ""),
        fim: String(x?.fim || ""),
      }))
    : p.periodos.map((x) => ({ ...x }));
  const pausa =
    r.pausa && (r.pausa.inicio || r.pausa.fim)
      ? { inicio: String(r.pausa.inicio || ""), fim: String(r.pausa.fim || "") }
      : null;
  const bancas = inteiro(r.bancas, p.bancas);
  return {
    schema: VERSAO_DA_REGRA_DA_AGENDA,
    datas: {
      modo: datas.modo === "LISTA" ? "LISTA" : "INTERVALO",
      inicio: String(datas.inicio || ""),
      fim: String(datas.fim || ""),
      so_dias_uteis: datas.so_dias_uteis !== false,
      dias: listaDeDatas(datas.dias),
      excluir: listaDeDatas(datas.excluir),
    },
    periodos,
    duracao_min: inteiro(r.duracao_min, p.duracao_min),
    intervalo_min: inteiro(r.intervalo_min, p.intervalo_min),
    pausa,
    bancas,
    nomes_das_bancas: Array.isArray(r.nomes_das_bancas)
      ? r.nomes_das_bancas
          .slice(0, LIMITES_DA_AGENDA.bancas[1])
          .map((n) => String(n ?? "").trim())
      : [],
    ordem: ORDENS_DA_AGENDA.some(([v]) => v === r.ordem) ? r.ordem : p.ordem,
    agrupar_por_cargo: r.agrupar_por_cargo === true,
    reservar_primeiro_horario: r.reservar_primeiro_horario === true,
    fuso: FUSO_DA_AGENDA,
  };
}

/** Os dias da agenda, em ordem (sem os excluídos; só úteis, se a regra pedir). */
export function diasDaRegra(regraBruta) {
  const r = normalizarRegraDaAgenda(regraBruta);
  const excluir = new Set(r.datas.excluir);
  let dias = [];
  if (r.datas.modo === "LISTA") dias = r.datas.dias.filter(dataValida);
  else if (
    dataValida(r.datas.inicio) &&
    dataValida(r.datas.fim) &&
    r.datas.inicio <= r.datas.fim
  ) {
    for (
      let d = r.datas.inicio, n = 0;
      d <= r.datas.fim && n < 400;
      d = somarDias(d, 1), n += 1
    ) {
      const semana = diaDaSemanaNumero(d);
      if (r.datas.so_dias_uteis && (semana === 0 || semana === 6)) continue;
      dias.push(d);
    }
  }
  return dias.filter((d) => !excluir.has(d));
}

/** Os erros da regra (vazio = pode salvar). As mesmas do banco. */
export function validarRegraDaAgenda(regraBruta) {
  const r = normalizarRegraDaAgenda(regraBruta);
  const L = LIMITES_DA_AGENDA;
  const erros = [];
  if (r.datas.modo === "INTERVALO") {
    if (!dataValida(r.datas.inicio) || !dataValida(r.datas.fim))
      erros.push("Informe a data de início e a de fim.");
    else if (r.datas.inicio > r.datas.fim)
      erros.push("A data de fim vem antes da de início.");
  } else if (!r.datas.dias.length) erros.push("Informe ao menos um dia.");
  if (
    r.datas.dias.some((d) => !dataValida(d)) ||
    r.datas.excluir.some((d) => !dataValida(d))
  )
    erros.push("Há dia inválido na lista.");
  const dias = diasDaRegra(r);
  if (!erros.length && !dias.length)
    erros.push("Nenhum dia sobra para as entrevistas.");
  if (dias.length > L.dias) erros.push(`Até ${L.dias} dias de entrevista.`);

  if (!r.periodos.length || r.periodos.length > L.periodos)
    erros.push(`De 1 a ${L.periodos} períodos por dia.`);
  if (
    r.periodos.some(
      (p) =>
        !horaValida(p.inicio) ||
        !horaValida(p.fim) ||
        minutos(p.inicio) >= minutos(p.fim),
    )
  )
    erros.push("Cada período precisa de início antes do fim (HH:MM).");
  else {
    const ordenados = [...r.periodos].sort(
      (a, b) => minutos(a.inicio) - minutos(b.inicio),
    );
    for (let i = 1; i < ordenados.length; i += 1)
      if (minutos(ordenados[i].inicio) < minutos(ordenados[i - 1].fim)) {
        erros.push("Os períodos não podem se sobrepor.");
        break;
      }
  }
  if (r.duracao_min < L.duracao[0] || r.duracao_min > L.duracao[1])
    erros.push(
      `Duração de cada entrevista entre ${L.duracao[0]} e ${L.duracao[1]} minutos.`,
    );
  if (r.intervalo_min < L.intervalo[0] || r.intervalo_min > L.intervalo[1])
    erros.push(
      `Intervalo entre entrevistas entre ${L.intervalo[0]} e ${L.intervalo[1]} minutos.`,
    );
  if (
    r.pausa &&
    (!horaValida(r.pausa.inicio) ||
      !horaValida(r.pausa.fim) ||
      minutos(r.pausa.inicio) >= minutos(r.pausa.fim))
  )
    erros.push("A pausa precisa de início antes do fim (HH:MM).");
  if (r.bancas < L.bancas[0] || r.bancas > L.bancas[1])
    erros.push(`De ${L.bancas[0]} a ${L.bancas[1]} bancas simultâneas.`);
  if (r.nomes_das_bancas.some((n) => n.length > L.nomeDaBanca))
    erros.push(`Nome da banca com até ${L.nomeDaBanca} caracteres.`);
  return erros;
}

/** O nome da banca n (1, 2…): o da regra ou "Banca n". */
export function nomeDaBanca(regraBruta, numero) {
  const r = normalizarRegraDaAgenda(regraBruta);
  return r.nomes_das_bancas[numero - 1] || `Banca ${numero}`;
}

/**
 * Os horários da regra, em ordem: { data, inicio, fim, reservado }. Cada um
 * vale para todas as bancas.
 */
export function horariosDaRegra(regraBruta) {
  const r = normalizarRegraDaAgenda(regraBruta);
  if (validarRegraDaAgenda(r).length) return [];
  const passo = r.duracao_min + r.intervalo_min;
  const pausa = r.pausa
    ? [minutos(r.pausa.inicio), minutos(r.pausa.fim)]
    : null;
  const periodos = [...r.periodos].sort(
    (a, b) => minutos(a.inicio) - minutos(b.inicio),
  );
  const horarios = [];
  for (const data of diasDaRegra(r)) {
    for (const p of periodos) {
      const fimDoPeriodo = minutos(p.fim);
      let t = minutos(p.inicio);
      let primeiro = true;
      while (t + r.duracao_min <= fimDoPeriodo) {
        const fim = t + r.duracao_min;
        if (pausa && t < pausa[1] && fim > pausa[0]) {
          t = pausa[1];
          continue;
        }
        horarios.push({
          data,
          inicio: hora(t),
          fim: hora(fim),
          reservado: primeiro && r.reservar_primeiro_horario,
        });
        primeiro = false;
        t += passo;
      }
    }
  }
  return horarios;
}

/* ── Convocados ────────────────────────────────────────────────────── */

/**
 * Os convocados de uma lista de convocação — o retrato registrado
 * (analise_id) ou o resultado do motor (analiseId) —, sem repetir, na ordem
 * da lista: por vaga, a geral e depois quem só está numa lista de modalidade.
 */
export function convocadosDaLista(lista) {
  const vistos = new Set();
  const convocados = [];
  for (const v of lista?.vagas || []) {
    const listas = [
      v.geral || [],
      ...Object.values(v.listas || v.porModalidade || {}),
    ];
    for (const linhas of listas)
      for (const l of linhas || []) {
        const id = l.analise_id || l.analiseId;
        if (!id || vistos.has(id)) continue;
        vistos.add(id);
        convocados.push({
          analiseId: id,
          nome: l.nome || "",
          vaga: v.codigo || "",
          cargo: v.cargo || "",
          lotacao: v.lotacao || "",
          posicao: Number.isFinite(l.posicao) ? l.posicao : null,
          modalidades: Array.isArray(l.modalidades) ? l.modalidades : [],
        });
      }
  }
  return convocados;
}

const semAcento = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const comparaTexto = (a, b) =>
  String(a || "").localeCompare(String(b || ""), "pt-BR", {
    sensitivity: "base",
    numeric: true,
  });
/** A modalidade de ordenação: a primeira cota; sem cota, AC. */
export const modalidadeDoConvocado = (c) =>
  (c.modalidades || []).find((m) => m && m !== "AC") || "AC";

/** Os convocados na ordem da regra (estável). */
export function ordenarConvocados(convocados, regraBruta) {
  const r = normalizarRegraDaAgenda(regraBruta);
  const base = (convocados || []).map((c, indice) => ({ c, indice }));
  const posicao = (x) => x.c.posicao ?? Number.MAX_SAFE_INTEGER;
  const criterios = {
    CLASSIFICACAO: (a, b) => posicao(a) - posicao(b),
    VAGA: (a, b) =>
      comparaTexto(a.c.vaga, b.c.vaga) ||
      comparaTexto(a.c.cargo, b.c.cargo) ||
      posicao(a) - posicao(b),
    ALFABETICA: (a, b) => comparaTexto(a.c.nome, b.c.nome),
    MODALIDADE: (a, b) => {
      const ma = modalidadeDoConvocado(a.c);
      const mb = modalidadeDoConvocado(b.c);
      if (ma !== mb) {
        if (ma === "AC") return -1;
        if (mb === "AC") return 1;
        return comparaTexto(ma, mb);
      }
      return posicao(a) - posicao(b);
    },
  };
  const criterio = criterios[r.ordem];
  base.sort((a, b) => criterio(a, b) || a.indice - b.indice);
  let ordenados = base.map((x) => x.c);
  if (r.agrupar_por_cargo) {
    const grupos = new Map();
    for (const c of ordenados) {
      const chave = semAcento(c.cargo) || semAcento(c.vaga);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(c);
    }
    ordenados = [...grupos.values()].flat();
  }
  return ordenados;
}

/* ── Geração ───────────────────────────────────────────────────────── */

const chaveDoCargo = (c) => semAcento(c.cargo) || semAcento(c.vaga);

/**
 * Gera a agenda: { itens, semHorario, avisos, totais }. `itens` traz um por
 * convocado com horário ({ analiseId, nome, vaga, cargo, modalidades,
 * posicao, data, inicio, fim, banca, origem: "GERADA" }); `semHorario`, os
 * que não couberam.
 */
export function gerarAgenda(convocados, regraBruta) {
  const r = normalizarRegraDaAgenda(regraBruta);
  const horarios = horariosDaRegra(r).filter((h) => !h.reservado);
  const ordenados = ordenarConvocados(convocados, r);
  const itens = [];
  const semHorario = [];
  let linha = 0;
  let assento = 0;
  let cargoAnterior = null;
  for (const c of ordenados) {
    const cargo = chaveDoCargo(c);
    if (
      r.agrupar_por_cargo &&
      cargoAnterior !== null &&
      cargo !== cargoAnterior &&
      assento > 0
    ) {
      linha += 1;
      assento = 0;
    }
    cargoAnterior = cargo;
    const h = horarios[linha];
    if (!h) {
      semHorario.push(c);
      continue;
    }
    itens.push({
      ...c,
      data: h.data,
      inicio: h.inicio,
      fim: h.fim,
      banca: assento + 1,
      origem: "GERADA",
    });
    assento += 1;
    if (assento >= r.bancas) {
      linha += 1;
      assento = 0;
    }
  }
  const dias = diasDaRegra(r);
  const lugares = horarios.length * r.bancas;
  const sobra = Math.max(0, lugares - itens.length);
  const ultimoDia = itens.length ? itens[itens.length - 1].data : null;
  const diasNecessarios = ultimoDia ? dias.indexOf(ultimoDia) + 1 : 0;
  const passo = r.duracao_min + r.intervalo_min;
  const faltaMin = semHorario.length
    ? Math.ceil(semHorario.length / r.bancas) * passo
    : 0;
  const avisos = [];
  if (semHorario.length)
    avisos.push({
      codigo: "NAO_CABE",
      tom: "danger",
      texto: `${semHorario.length} ${semHorario.length === 1 ? "convocado ficou" : "convocados ficaram"} sem horário: faltam cerca de ${textoDaDuracao(faltaMin)} de entrevistas com ${r.bancas} ${r.bancas === 1 ? "banca" : "bancas"}. Acrescente dias, períodos ou bancas.`,
    });
  else if (
    itens.length &&
    sobra >= Math.max(r.bancas * 2, Math.ceil(lugares * 0.3))
  )
    avisos.push({
      codigo: "SOBRA",
      tom: "warning",
      texto: `Sobram ${sobra} horários livres${diasNecessarios < dias.length ? `: bastam ${diasNecessarios} dos ${dias.length} dias` : ""}.`,
    });
  return {
    itens,
    semHorario,
    avisos,
    totais: {
      convocados: ordenados.length,
      comHorario: itens.length,
      semHorario: semHorario.length,
      lugares,
      sobra,
      dias: dias.length,
      diasNecessarios,
      faltaMin,
      bancas: r.bancas,
    },
  };
}

/* ── Ajuste manual e conflitos ─────────────────────────────────────── */

const comHorario = (i) => Boolean(i.data && i.inicio && i.fim && i.banca);

/** Ordena por dia, hora e banca (sem horário no fim). */
export function ordenarAgenda(itens) {
  return [...(itens || [])].sort((a, b) => {
    if (comHorario(a) !== comHorario(b)) return comHorario(a) ? -1 : 1;
    return (
      String(a.data || "").localeCompare(String(b.data || "")) ||
      String(a.inicio || "").localeCompare(String(b.inicio || "")) ||
      (a.banca || 0) - (b.banca || 0) ||
      comparaTexto(a.nome, b.nome)
    );
  });
}

/**
 * Os conflitos: mesma banca com horários que se sobrepõem no mesmo dia
 * (tipo HORARIO) e candidato repetido (tipo REPETIDO). Cada um traz os ids.
 */
export function conflitosDaAgenda(itens, regraBruta = null) {
  const conflitos = [];
  const porId = new Map();
  for (const i of itens || []) {
    porId.set(i.analiseId, (porId.get(i.analiseId) || 0) + 1);
  }
  for (const [id, n] of porId)
    if (n > 1) {
      const nome = itens.find((i) => i.analiseId === id)?.nome || "";
      conflitos.push({
        tipo: "REPETIDO",
        ids: [id],
        texto: `${nome} aparece ${n} vezes na agenda.`,
      });
    }
  const grupos = new Map();
  for (const i of itens || []) {
    if (!comHorario(i)) continue;
    const chave = `${i.data}|${i.banca}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(i);
  }
  for (const lista of grupos.values()) {
    const ordenados = [...lista].sort(
      (a, b) => minutos(a.inicio) - minutos(b.inicio),
    );
    /*
      Compara cada horário com o que termina mais tarde entre os anteriores,
      não só com o vizinho: uma entrevista longa pode cobrir várias seguintes.
    */
    let a = null;
    for (const b of ordenados) {
      // O repetido já é acusado como REPETIDO; não conflita consigo.
      if (
        a &&
        a.analiseId !== b.analiseId &&
        minutos(b.inicio) < minutos(a.fim)
      )
        conflitos.push({
          tipo: "HORARIO",
          ids: [a.analiseId, b.analiseId],
          texto: `${a.nome} e ${b.nome}: ${nomeDaBanca(regraBruta, a.banca)}, ${dataBR(a.data)}, ${a.inicio}.`,
        });
      if (!a || minutos(b.fim) > minutos(a.fim)) a = b;
    }
  }
  return conflitos;
}

/** O horário de alguém muda (ou sai, com `horario` nulo): vira ajuste manual. */
export function moverNaAgenda(itens, analiseId, horario) {
  return (itens || []).map((i) =>
    i.analiseId === analiseId
      ? {
          ...i,
          data: horario?.data || null,
          inicio: horario?.inicio || null,
          fim: horario?.fim || null,
          banca: horario?.banca || null,
          origem: "MANUAL",
        }
      : i,
  );
}

/** Dois candidatos trocam de horário e banca: os dois viram ajuste manual. */
export function trocarNaAgenda(itens, idA, idB) {
  const a = (itens || []).find((i) => i.analiseId === idA);
  const b = (itens || []).find((i) => i.analiseId === idB);
  if (!a || !b || idA === idB) return itens;
  const lugar = (x) => ({
    data: x.data,
    inicio: x.inicio,
    fim: x.fim,
    banca: x.banca,
  });
  return itens.map((i) =>
    i.analiseId === idA
      ? { ...i, ...lugar(b), origem: "MANUAL" }
      : i.analiseId === idB
        ? { ...i, ...lugar(a), origem: "MANUAL" }
        : i,
  );
}

/** Os horários da regra × bancas ainda sem ninguém (os reservados também). */
export function horariosLivres(itens, regraBruta) {
  const r = normalizarRegraDaAgenda(regraBruta);
  const ocupados = new Set(
    (itens || [])
      .filter(comHorario)
      .map((i) => `${i.data}|${i.inicio}|${i.banca}`),
  );
  const livres = [];
  for (const h of horariosDaRegra(r))
    for (let banca = 1; banca <= r.bancas; banca += 1)
      if (!ocupados.has(`${h.data}|${h.inicio}|${banca}`))
        livres.push({ ...h, banca });
  return livres;
}

export const temAjusteManual = (itens) =>
  (itens || []).some((i) => i.origem === "MANUAL");

/** analiseId → { data, inicio, fim, banca } (para o documento da convocação). */
export function agendaPorCandidato(itens) {
  const mapa = new Map();
  for (const i of itens || [])
    if (comHorario(i))
      mapa.set(i.analiseId, {
        data: i.data,
        inicio: i.inicio,
        fim: i.fim,
        banca: i.banca,
      });
  return mapa;
}

/** O que vai para salvar_agenda_entrevista (só quem tem horário). */
export function itensParaSalvar(itens) {
  return (itens || []).filter(comHorario).map((i) => ({
    analise: i.analiseId,
    data: i.data,
    inicio: i.inicio,
    fim: i.fim,
    banca: i.banca,
    origem: i.origem === "MANUAL" ? "MANUAL" : "GERADA",
  }));
}

/** Itens do banco (obter_agenda_entrevista) no formato do motor. */
export function itensDoBanco(linhas) {
  return (linhas || []).map((l) => ({
    analiseId: l.analise_id,
    nome: l.nome || "",
    vaga: l.vaga || "",
    cargo: l.cargo || "",
    modalidades: l.modalidade ? [l.modalidade] : [],
    posicao: null,
    data: l.data || null,
    inicio: String(l.inicio || "").slice(0, 5) || null,
    fim: String(l.fim || "").slice(0, 5) || null,
    banca: l.banca || null,
    origem: l.origem === "MANUAL" ? "MANUAL" : "GERADA",
  }));
}

/**
 * Junta a agenda salva com os convocados da lista atual: quem está na lista
 * fica com os dados dela (nome, vaga, posição) e o horário salvo; quem foi
 * salvo e saiu da lista vem com `foraDaLista`.
 */
export function juntarComConvocados(salvos, convocados) {
  const porId = new Map((salvos || []).map((s) => [s.analiseId, s]));
  const itens = (convocados || []).map((c) => {
    const s = porId.get(c.analiseId);
    porId.delete(c.analiseId);
    return s
      ? {
          ...c,
          data: s.data,
          inicio: s.inicio,
          fim: s.fim,
          banca: s.banca,
          origem: s.origem,
        }
      : {
          ...c,
          data: null,
          inicio: null,
          fim: null,
          banca: null,
          origem: "GERADA",
        };
  });
  for (const s of porId.values()) itens.push({ ...s, foraDaLista: true });
  return itens;
}

/* ── Exportação ────────────────────────────────────────────────────── */

/** As linhas da planilha da agenda (uma por convocado, na ordem da agenda). */
export function linhasDaAgenda(itens, regraBruta = null) {
  const linhas = [
    [
      "Data",
      "Dia",
      "Início (Brasília)",
      "Fim",
      "Banca",
      "Nome",
      "Vaga",
      "Cargo",
      "Modalidade",
      "Origem",
    ],
  ];
  for (const i of ordenarAgenda(itens))
    linhas.push([
      dataBR(i.data) || "Sem horário",
      i.data ? NOMES_DOS_DIAS[diaDaSemanaNumero(i.data)] : "",
      i.inicio || "",
      i.fim || "",
      i.banca ? nomeDaBanca(regraBruta, i.banca) : "",
      i.nome || "",
      i.vaga || "",
      i.cargo || "",
      (i.modalidades || []).join(" / "),
      ORIGENS_DA_AGENDA[i.origem] || "",
    ]);
  return linhas;
}

/** Os bytes do .xlsx da agenda. */
export function gerarXlsxDaAgenda(
  itens,
  regraBruta = null,
  quando = new Date(),
) {
  return gerarXlsx(
    [{ nome: "Agenda", linhas: linhasDaAgenda(itens, regraBruta) }],
    quando,
  );
}

/** "agenda-entrevistas-100-2026" (sem extensão). */
export function nomeDoArquivoDaAgenda(edital) {
  const numero = String(edital || "edital")
    .replace(/[^0-9a-z]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `agenda-entrevistas-${numero || "edital"}`;
}
