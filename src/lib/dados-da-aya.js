/*
  As contas da Aya para as perguntas com número (src/lib/intencoes-da-aya.js)
  e a orquestração da resposta com dados ao vivo.

  Sem DOM e sem rede: `responderComDados` recebe `buscar(fonte, { area })`
  injetado (em produção, src/modulos/aya/fontes.js chama as RPCs de leitura
  que a tela já usa). As contas usam as mesmas regras puras das telas
  (calcularKpis das Análises, calcularIndicadores de Recursos, Entrevistas e
  Seleção, normalizarSaude do Status das atualizações), para o número da Aya
  ser o mesmo do indicador.

  Permissão: antes de buscar, a regra da página (paginasPermitidas) e, no
  Status das atualizações, o administrador global. O banco confere de novo
  em cada RPC; erro de acesso vira "sem acesso", nunca o dado.
*/
import { calcularKpis } from "./analises-curriculares.ts";
import { isAdminGlobal, paginasPermitidas } from "./access-roles.js";
import { calcularIndicadores as indicadoresDasEntrevistas } from "./entrevistas-do-painel.ts";
import { calcularIndicadores as indicadoresDosRecursos } from "./recursos-dos-candidatos.js";
import {
  normalizarSaude,
  SITUACOES,
  visaoSimples,
} from "./saude-das-cargas.ts";
import { calcularIndicadores as indicadoresDaSelecao } from "./selecao-do-painel.ts";
import {
  acaoDaIntencao,
  mesmoEdital,
  NOMES_DAS_AREAS,
  reconhecerIntencao,
  textoDaIntencao,
} from "./intencoes-da-aya.js";

const NOME_DA_TELA = Object.freeze({
  analises: "Análises curriculares",
  recursos: "Recursos",
  entrevistas: "Entrevistas",
  selecao: "Seleção",
  config: "Status das atualizações",
});

/* ---------- Contas ---------- */

const doEdital = (lista, edital) =>
  (lista || []).filter((item) => mesmoEdital(item?.edital, edital));

/** Os números das Análises (linhas do painel) no recorte do edital. */
export function contarAnalises(linhas, { edital = "" } = {}) {
  const recorte = doEdital(linhas, edital);
  const desativadas = recorte.filter((linha) => linha?.__desativada === true);
  return {
    ...calcularKpis(recorte),
    vazio: !recorte.length,
    // Quantas de cada número são análises desativadas (só em Todos na tela).
    desativadas: calcularKpis(desativadas),
  };
}

/** Os números de Recursos (já enriquecidos com prazo e situação). */
export function contarRecursos(recursos, { edital = "" } = {}) {
  const recorte = doEdital(recursos, edital);
  return { ...indicadoresDosRecursos(recorte), vazio: !recorte.length };
}

/*
  Entrevistas: "convocado sem nota" é a entrevista registrada que ainda não
  tem nota final e em que a pessoa não foi marcada como ausente.
*/
export function contarEntrevistas(
  { entrevistas = [], aprovadosSemEntrevista = [] } = {},
  { edital = "" } = {},
) {
  const recorte = doEdital(entrevistas, edital);
  const semEntrevista = doEdital(aprovadosSemEntrevista, edital);
  return {
    ...indicadoresDasEntrevistas(recorte, semEntrevista),
    semNota: recorte.filter((e) => e.nota === null && e.compareceu !== "N")
      .length,
    total: recorte.length,
    vazio: !recorte.length && !semEntrevista.length,
  };
}

/** O funil da Seleção (vagas da área) no recorte do edital. */
export function contarSelecao(vagas, { edital = "" } = {}) {
  const recorte = doEdital(vagas, edital);
  return { ...indicadoresDaSelecao(recorte), vazio: !recorte.length };
}

/** As cargas que pedem atenção (atrasada, falhou…), pela visão simples da tela. */
export function cargasQuePedemAtencao(dados, agora = new Date()) {
  const linhas = visaoSimples(normalizarSaude(dados, agora));
  const atrasadas = linhas
    .filter((linha) => ["falhou", "atrasada"].includes(linha.situacao))
    .map(
      (linha) =>
        `${linha.titulo} (${SITUACOES[linha.situacao].rotulo.toLowerCase()})`,
    );
  return { total: linhas.length, atrasadas };
}

/* ---------- Orquestração ---------- */

function podeVer(perfil, intencao) {
  if (intencao.fonte === "cargas") return isAdminGlobal(perfil);
  if (!intencao.pagina) return true;
  return paginasPermitidas(perfil)[intencao.pagina] === true;
}

const ehErroDeAcesso = (erro) =>
  ["42501", "PGRST301", "401", "403"].includes(String(erro?.code ?? "")) ||
  /permiss|acesso|not allowed|denied/i.test(String(erro?.message ?? ""));

function resultadoDaContagem(intencao, numeros) {
  const id = intencao.metrica.id;
  if (intencao.id === "selecao" && id === "taxa")
    return {
      valor: Math.round(Number(numeros.taxa || 0) * 100),
      contratados: numeros.contratados,
      aprovados: numeros.aprovados,
    };
  return {
    valor: numeros[id] ?? 0,
    ...(intencao.id === "analises"
      ? { total: numeros.total, desativadas: numeros.desativadas?.[id] ?? 0 }
      : {}),
  };
}

const CONTAS = Object.freeze({
  analises: (dados, filtro) => contarAnalises(dados?.linhas || dados, filtro),
  recursos: (dados, filtro) => contarRecursos(dados?.recursos || dados, filtro),
  entrevistas: (dados, filtro) => contarEntrevistas(dados, filtro),
  selecao: (dados, filtro) => contarSelecao(dados?.vagas || dados, filtro),
});

/**
 * Responde a pergunta com dados ao vivo, se for uma intenção de dado.
 * Devolve `null` quando não é (a pergunta segue para a base de verbetes) ou
 * `{ answer, provider: "monitora-dados", acaoDados?, oferecerChamado? }`.
 *
 * `contexto`: `{ view, area, edital }`; `buscar(fonte, { area, cargaDe })`
 * devolve os dados normalizados da fonte (ou lança o erro da RPC).
 */
export async function responderComDados({
  pergunta,
  contexto = {},
  perfil = null,
  buscar,
  agora = () => new Date(),
} = {}) {
  const intencao = reconhecerIntencao(pergunta, contexto);
  if (!intencao) return null;
  const base = { provider: "monitora-dados", unavailable: false, sources: [] };

  if (intencao.tipo === "conferencia")
    return {
      ...base,
      provider: "base-monitora",
      answer:
        "As conferências de consistência ainda estão chegando ao MONITORA: quando entrarem, os avisos aparecem no Status das atualizações e num selo em cada módulo. Por enquanto, não há aviso de conferência para mostrar.",
    };

  if (!perfil || !podeVer(perfil, intencao)) {
    const tela = NOME_DA_TELA[intencao.view] || "essa tela";
    return {
      ...base,
      answer:
        intencao.fonte === "cargas"
          ? "Esse número fica no Status das atualizações, que só o administrador global vê."
          : `Seu acesso não inclui ${tela}, então não consigo mostrar esse número. Quem libera é o administrador de acessos da sua coordenação.`,
      oferecerChamado: false,
    };
  }
  if (typeof buscar !== "function") return null;

  const area = intencao.entidades.area || String(contexto.area || "");
  let dados;
  try {
    dados = await buscar(intencao.fonte, { area, cargaDe: intencao.cargaDe });
  } catch (erro) {
    return {
      ...base,
      answer: ehErroDeAcesso(erro)
        ? `Seu acesso não deixa ver esses dados${area && NOMES_DAS_AREAS[area] ? ` da ${NOMES_DAS_AREAS[area]}` : ""}.`
        : "Não consegui buscar esse número agora. Tente de novo em instantes ou abra a tela.",
      acaoDados: acaoDaIntencao(intencao),
      oferecerChamado: !ehErroDeAcesso(erro),
    };
  }

  const comArea = {
    ...intencao,
    entidades: { ...intencao.entidades, area },
  };
  if (intencao.tipo === "carga")
    return {
      ...base,
      answer: textoDaIntencao(comArea, { em: dados?.em ?? dados }),
      acaoDados: acaoDaIntencao({ ...comArea, metrica: null, entidades: {} }),
    };
  if (intencao.tipo === "atrasos")
    return {
      ...base,
      answer: textoDaIntencao(comArea, cargasQuePedemAtencao(dados, agora())),
      acaoDados: acaoDaIntencao(comArea),
    };

  const numeros = CONTAS[intencao.fonte](dados, {
    edital: intencao.entidades.edital,
  });
  const semEdital = Boolean(intencao.entidades.edital) && numeros.vazio;
  return {
    ...base,
    answer: textoDaIntencao(
      { ...comArea, editalSemDados: semEdital },
      resultadoDaContagem(intencao, numeros),
    ),
    acaoDados: acaoDaIntencao(comArea),
  };
}
