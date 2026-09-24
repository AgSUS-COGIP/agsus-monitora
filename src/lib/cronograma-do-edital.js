/*
  Cronograma de um edital — o que o formulário do Núcleo calcula e valida antes
  de salvar, sem DOM nem rede. A tela é `src/componentes/nucleo/`.

  O status e a etapa do edital saem das datas quando o cronograma é
  "automático": quem cadastra informa as etapas, e o sistema diz se o edital
  está planejado, em andamento ou concluído. O status excepcional (suspenso,
  cancelado, paralisado) é a única forma de o contrariar, e exige motivo e data.
*/

import { ANO_MAXIMO, ANO_MINIMO, dataPlausivel } from "./datas-do-cronograma.js";

const txt = (valor) => String(valor ?? "").trim();

export const PENDENTE = "Cronograma pendente";

/** As etapas do modelo padrão, na ordem em que um edital da AgSUS corre. */
export const MODELO_PADRAO = Object.freeze([
  "Publicação do Edital",
  "Impugnação do Edital",
  "Período de inscrição e envio dos documentos comprobatórios",
  "Resultado Preliminar da Avaliação Documental e de Títulos",
  "Prazo de recurso do resultado preliminar documental",
  "Resultado Final da Avaliação Documental e de Títulos",
  "Convocação para Entrevista",
  "Período de Entrevistas",
  "Resultado Preliminar das Entrevistas",
  "Prazo para recursos das entrevistas",
  "Resultado final da Entrevista",
  "Resultado final do Processo Seletivo",
]);

export const STATUS_EXCEPCIONAIS = Object.freeze([
  "Suspenso",
  "Cancelado",
  "Paralisado",
]);

/** Uma etapa como o formulário a guarda. */
export function novaEtapa(dados = {}, ordem = 1) {
  return {
    ordem: Number(dados.ordem || ordem),
    atividade: txt(dados.atividade),
    data_inicio: txt(dados.data_inicio),
    data_fim: txt(dados.data_fim || dados.data_inicio),
    origem: txt(dados.origem || "MANUAL").toUpperCase(),
    observacao: txt(dados.observacao),
    concluida: dados.concluida ?? null,
    confianca_extracao: dados.confianca_extracao ?? null,
  };
}

export const renumerar = (etapas) =>
  etapas.map((etapa, indice) => ({ ...etapa, ordem: indice + 1 }));

export const etapasDoModeloPadrao = () =>
  MODELO_PADRAO.map((atividade, indice) =>
    novaEtapa({ atividade, origem: "MANUAL" }, indice + 1),
  );

function dataLocal(valor) {
  if (!valor) return null;
  const data = new Date(`${valor}T12:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

const dataCurta = (iso) => String(iso).split("-").reverse().join("/");

/**
 * O que o cronograma diz do edital hoje.
 *
 * @param {Array} etapas
 * @param {{automatico?: boolean, statusExcepcional?: string, etapaExcepcional?: string, hoje?: Date}} opcoes
 * @returns {{status: string, etapa: string, proxima: string, percentual: number}}
 */
export function estadoDoCronograma(etapas, opcoes = {}) {
  const validas = (etapas || [])
    .filter((etapa) => etapa.atividade && etapa.data_inicio && etapa.data_fim)
    .slice()
    .sort(
      (a, b) =>
        String(a.data_inicio).localeCompare(String(b.data_inicio)) ||
        a.ordem - b.ordem,
    );
  if (!validas.length || opcoes.automatico === false)
    return { status: PENDENTE, etapa: PENDENTE, proxima: "-", percentual: 0 };

  const referencia = opcoes.hoje || new Date();
  const hoje = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
    12,
  );
  const primeira = validas[0];
  const ultima = validas[validas.length - 1];
  const atual = validas.find(
    (etapa) =>
      hoje >= dataLocal(etapa.data_inicio) && hoje <= dataLocal(etapa.data_fim),
  );
  const proxima = validas.find((etapa) => dataLocal(etapa.data_inicio) > hoje);
  const concluidas = validas.filter(
    (etapa) => dataLocal(etapa.data_fim) < hoje,
  ).length;

  let status = "Em andamento";
  let etapa =
    atual?.atividade ||
    (proxima ? `Aguardando: ${proxima.atividade}` : ultima.atividade);
  if (hoje < dataLocal(primeira.data_inicio)) {
    status = "Planejado";
    etapa = `Aguardando: ${primeira.atividade}`;
  }
  const terminou = hoje > dataLocal(ultima.data_fim);
  if (terminou) {
    status = "Concluído";
    etapa = ultima.atividade;
  }
  return {
    status: txt(opcoes.statusExcepcional) || status,
    etapa: txt(opcoes.etapaExcepcional) || etapa,
    proxima: proxima
      ? `${proxima.atividade} — ${dataCurta(proxima.data_inicio)}`
      : "Sem próxima atividade",
    percentual: terminou
      ? 100
      : Math.round((concluidas / validas.length) * 100),
  };
}

/**
 * Erros impedem salvar; avisos pedem confirmação.
 *
 * @param {object} edital o payload do edital (edital, unidade, automático, status excepcional…)
 * @param {Array} etapas
 * @param {string} motivo o motivo da alteração, que vai para o histórico
 */
export function analisarCronograma(
  edital,
  etapas,
  motivo,
  { exigirMotivo = true } = {},
) {
  const erros = [];
  const avisos = [];
  if (!edital.edital || !edital.unidade)
    erros.push("Informe pelo menos edital e unidade.");
  if (edital.cronograma_automatico && !etapas.length)
    erros.push(
      "Adicione pelo menos uma etapa ou desative o cálculo automático.",
    );

  const vistas = new Set();
  const ano = Number((txt(edital.edital).match(/\b(20\d{2})\b/) || [])[1]);
  etapas.forEach((etapa, indice) => {
    const rotulo = `Etapa ${indice + 1}`;
    if (!etapa.atividade || !etapa.data_inicio || !etapa.data_fim)
      erros.push(`${rotulo}: preencha atividade, início e fim.`);
    if (
      etapa.data_inicio &&
      etapa.data_fim &&
      etapa.data_fim < etapa.data_inicio
    )
      erros.push(`${rotulo}: a data final é anterior à inicial.`);
    /*
      Ano digitado errado (0202, 2206) era só aviso e salvava: seis etapas
      foram gravadas assim e apareciam no Cronograma como "(666205 dias)".
    */
    for (const [campo, nome] of [
      ["data_inicio", "início"],
      ["data_fim", "fim"],
    ]) {
      if (etapa[campo] && !dataPlausivel(etapa[campo]))
        erros.push(
          `${rotulo}: o ano do ${nome} (${etapa[campo].slice(0, 4)}) não é possível. Use um ano entre ${ANO_MINIMO} e ${ANO_MAXIMO}.`,
        );
    }
    const chave = txt(etapa.atividade).toLowerCase();
    if (chave && vistas.has(chave))
      erros.push(`${rotulo}: atividade duplicada.`);
    vistas.add(chave);
    if (
      ano &&
      etapa.data_inicio &&
      Number(etapa.data_inicio.slice(0, 4)) !== ano
    )
      avisos.push(`${rotulo}: data fora do ano ${ano}.`);
  });
  if (
    etapas.length &&
    !etapas.some((etapa) =>
      etapa.atividade.toLowerCase().includes("resultado final"),
    )
  )
    avisos.push("O cronograma não possui uma etapa de resultado final.");
  for (let i = 1; i < etapas.length; i += 1) {
    const anterior = etapas[i - 1];
    const atual = etapas[i];
    if (
      anterior.data_inicio &&
      atual.data_inicio &&
      atual.data_inicio < anterior.data_inicio
    )
      avisos.push(`A etapa ${i + 1} começa antes da etapa ${i}.`);
    if (
      anterior.data_fim &&
      atual.data_inicio &&
      atual.data_inicio <= anterior.data_fim
    )
      avisos.push(`As etapas ${i} e ${i + 1} possuem datas sobrepostas.`);
  }
  if (
    edital.status_override &&
    (!edital.status_override_motivo || !edital.status_override_data)
  )
    erros.push("Status excepcional exige motivo e data da decisão.");
  if (exigirMotivo && !txt(motivo))
    erros.push("Informe o motivo da alteração do cronograma.");
  return { erros: [...new Set(erros)], avisos: [...new Set(avisos)] };
}

// ── Datas coladas em lote ────────────────────────────────────────────────

const DATA = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g;

function paraIso(dia, mes, ano) {
  let y = Number(ano);
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  const data = new Date(y, Number(mes) - 1, Number(dia), 12);
  if (
    data.getFullYear() !== y ||
    data.getMonth() !== Number(mes) - 1 ||
    data.getDate() !== Number(dia)
  )
    return "";
  return `${String(y).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function lerData(trecho) {
  const partes = String(trecho || "").match(
    /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/,
  );
  return partes ? paraIso(partes[1], partes[2], partes[3]) : "";
}

/**
 * Uma linha colada: "17/06/2026", "18/06/2026 a 20/06/2026" ou "18 a 20/06/2026".
 * @returns {{inicio: string, fim: string} | null}
 */
export function lerLinhaDeDatas(linha) {
  const limpa = String(linha || "")
    .replace(/[–—]/g, "-")
    .trim();
  const datas = [...limpa.matchAll(DATA)]
    .map((achado) => lerData(achado[0]))
    .filter(Boolean);
  if (datas.length >= 2) return { inicio: datas[0], fim: datas[1] };
  /*
    O intervalo curto ("18 a 20/06/2026") vem antes da data única: ele também
    contém uma data completa, "20/06/2026", e lido como data única perdia o
    dia 18.
  */
  const curto = limpa.match(
    /\b(\d{1,2})\s*(?:a|até|ate|-)\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/i,
  );
  if (curto)
    return {
      inicio: paraIso(curto[1], curto[3], curto[4]),
      fim: paraIso(curto[2], curto[3], curto[4]),
    };
  if (datas.length === 1) return { inicio: datas[0], fim: datas[0] };
  return null;
}

/**
 * Aplica as datas coladas às etapas, na ordem.
 * @returns {{etapas: Array, aviso: {texto: string, tom: "error"|"warning"|"success"}}}
 */
export function aplicarDatasEmLote(etapas, texto) {
  const linhas = String(texto || "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
  if (!etapas.length)
    return {
      etapas,
      aviso: {
        texto: "Use primeiro o modelo padrão para criar as atividades.",
        tom: "error",
      },
    };
  if (!linhas.length)
    return {
      etapas,
      aviso: { texto: "Cole pelo menos uma data ou intervalo.", tom: "error" },
    };

  const lidas = linhas.map(lerLinhaDeDatas);
  const invalidas = lidas.reduce((lista, item, indice) => {
    if (!item?.inicio || !item?.fim) lista.push(indice + 1);
    return lista;
  }, []);
  if (invalidas.length)
    return {
      etapas,
      aviso: {
        texto: `Não foi possível interpretar ${invalidas.length === 1 ? "a linha" : "as linhas"} ${invalidas.join(", ")}.`,
        tom: "error",
      },
    };

  const total = Math.min(etapas.length, lidas.length);
  const preenchidas = etapas.map((etapa, indice) =>
    indice < total
      ? {
          ...etapa,
          data_inicio: lidas[indice].inicio,
          data_fim: lidas[indice].fim,
        }
      : etapa,
  );
  const aviso =
    lidas.length < etapas.length
      ? {
          texto: `${total} datas aplicadas. Ainda faltam ${etapas.length - lidas.length} etapas para preencher.`,
          tom: "warning",
        }
      : lidas.length > etapas.length
        ? {
            texto: `${total} datas aplicadas. ${lidas.length - etapas.length} linhas excedentes foram ignoradas.`,
            tom: "warning",
          }
        : {
            texto: `${total} etapas preenchidas com sucesso. Revise antes de salvar.`,
            tom: "success",
          };
  return { etapas: preenchidas, aviso };
}

// ── Linha do tempo ───────────────────────────────────────────────────────

/** Hoje em Brasília, como "AAAA-MM-DD", para comparar com as datas das etapas. */
export function hojeEmBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** Concluída, em andamento, a próxima ou futura — só pelas datas. */
export function situacaoNaLinhaDoTempo(etapa, indice, etapas, hoje) {
  const inicio = String(etapa.data_inicio || "");
  const fim = String(etapa.data_fim || inicio);
  if (fim && hoje > fim) return "done";
  if (inicio && fim && hoje >= inicio && hoje <= fim) return "current";
  const primeiraFutura = etapas.findIndex(
    (item) => String(item.data_inicio || "") > hoje,
  );
  return indice === primeiraFutura ? "next" : "future";
}

export function formatarData(valor) {
  if (!valor) return "-";
  const bruto = String(valor).slice(0, 10);
  const partes = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : bruto;
}

export function formatarDataHora(valor) {
  if (!valor) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(valor));
  } catch {
    return String(valor);
  }
}
