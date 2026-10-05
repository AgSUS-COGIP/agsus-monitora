/*
  O ajuste da pontuação decidido em recurso, sem DOM e sem banco
  (TB_AJUSTE_PONTUACAO_RECURSO, migration 20261005130000):

  - `classificarEdital`: o motor com os dados do edital (o mesmo json de
    obter_classificacao_do_edital / obter_dados_previa_ajuste) e os ajustes
    APROVADOS por cima da nota da análise — a tela de Classificação e a
    prévia do recurso usam a mesma conta;
  - `itensDoAjuste`: os componentes da nota que a REGRA DO EDITAL tem
    (parciais da documental, nota documental, entrevista ou cada competência,
    ART), com o valor atual do candidato (análise/entrevista + ajustes
    aprovados de OUTROS recursos);
  - `montarItens` / `validarAjuste` / `itensParaEnviar`: o rascunho da tela
    (total documental = atual + soma das diferenças das parciais; total da
    entrevista = atual + soma das diferenças das competências);
  - `previaDoAjuste`: nova nota, nova posição e quem muda de posição por
    causa do ajuste, na lista da etapa (documental, entrevista ou final).
*/
import { ITEM_DO_AJUSTE_POR_CODIGO, ITENS_DO_AJUSTE } from "./catalogo.js";
import { dataDeCorteDoCronograma } from "./dados.js";
import {
  aplicarAgrupamentos,
  aplicarAjustes,
  classificar,
  ligarEntrevistas,
  prepararCandidatos,
  rotuloDoItem,
} from "./motor.js";
import { numeroBR } from "./numeros.js";
import { normalizarRegra } from "./regra.js";

/* A lista da etapa contra a qual o candidato recorreu (a da prévia). */
export const LISTA_DA_ORIGEM = Object.freeze({
  "analise-curricular": "PRELIMINAR",
  entrevista: "ENTREVISTA",
  "resultado-final": "FINAL",
});

export const LISTAS_DA_PREVIA = Object.freeze([
  ["PRELIMINAR", "Documental"],
  ["ENTREVISTA", "Entrevista"],
  ["FINAL", "Resultado final"],
]);

export const listaDaOrigem = (origem) => LISTA_DA_ORIGEM[origem] || "FINAL";

export const LIMITES_DO_AJUSTE = Object.freeze({
  justificativa: Object.freeze({ minimo: 10, maximo: 4000 }),
  itemJustificativa: Object.freeze({ minimo: 10, maximo: 2000 }),
  valor: Object.freeze({ minimo: 0, maximo: 1000 }),
});

const JUSTIFICATIVA_DO_TOTAL = "Soma das diferenças dos componentes ajustados.";

/** A classificação do edital numa lista, com os ajustes dados (padrão: os aprovados). */
export function classificarEdital(dados, tipo, ajustes = dados?.ajustes || []) {
  return classificar({
    tipo,
    regra: dados?.regra?.configuracao,
    candidatos: dados?.candidatos || [],
    entrevistas: dados?.entrevistas || [],
    quadro: dados?.quadro || [],
    unidade: dados?.edital?.unidade || "",
    dataCorte: dataDeCorteDoCronograma(dados?.cronograma),
    desempates: dados?.desempates || [],
    convocacao: dados?.convocacao || null,
    ajustes,
  });
}

/*
  O candidato como o motor o vê, com os ajustes aprovados — menos os do
  próprio recurso (`semRecurso`): a nova versão substitui a aprovada.
*/
export function candidatoAtual(dados, analiseId, { semRecurso = null } = {}) {
  const regra = normalizarRegra(dados?.regra?.configuracao);
  const avisos = [];
  const ajustes = (dados?.ajustes || []).filter(
    (a) => !semRecurso || a.recurso_id !== semRecurso,
  );
  const candidatos = aplicarAjustes(
    ligarEntrevistas(
      aplicarAgrupamentos(
        prepararCandidatos(dados?.candidatos || [], avisos),
        regra,
      ),
      dados?.entrevistas || [],
      avisos,
    ),
    ajustes,
    avisos,
  );
  return candidatos.find((c) => c.analiseId === analiseId) || null;
}

/**
 * Os componentes ajustáveis para a regra do edital e o candidato:
 * `[{ codigo, rotulo, atual, calculado, grupo }]`. `calculado`: o total que
 * sai da soma (documental com parciais; entrevista com competências).
 */
export function itensDoAjuste(regraBruta, candidato) {
  if (!candidato) return [];
  const regra = normalizarRegra(regraBruta);
  const itens = [];
  const parciais = ITENS_DO_AJUSTE.filter(
    (i) => i.parcial && regra.documental.parciais.includes(i.parcial),
  );
  for (const p of parciais)
    itens.push({
      codigo: p.codigo,
      rotulo: p.rotulo,
      atual: candidato[p.campo] ?? null,
      calculado: false,
      grupo: "DOCUMENTAL",
    });
  const componentes = regra.composicao.componentes.map((c) => c.codigo);
  if (regra.etapas.documental || componentes.includes("DOCUMENTAL"))
    itens.push({
      codigo: "DOCUMENTAL",
      rotulo: ITEM_DO_AJUSTE_POR_CODIGO.DOCUMENTAL.rotulo,
      atual: candidato.notaDocumental ?? null,
      calculado: parciais.length > 0,
      grupo: null,
    });
  if (
    regra.etapas.entrevista &&
    !regra.entrevista.so_parecer &&
    candidato.entrevista
  ) {
    const nomes = new Map(
      regra.entrevista.competencias.map((c) => [c.ordem, c.nome]),
    );
    const ordens = [
      ...new Set([
        ...regra.entrevista.competencias.map((c) => c.ordem),
        ...candidato.entrevista.notas
          .filter((n) => n.nota !== null)
          .map((n) => n.ordem),
      ]),
    ].sort((a, b) => a - b);
    for (const ordem of ordens) {
      const nota = candidato.entrevista.notas.find((n) => n.ordem === ordem);
      itens.push({
        codigo: `COMPETENCIA_${ordem}`,
        rotulo:
          nomes.get(ordem) ||
          nota?.criterio ||
          rotuloDoItem(`COMPETENCIA_${ordem}`),
        atual: nota?.nota ?? null,
        calculado: false,
        grupo: "ENTREVISTA",
      });
    }
    itens.push({
      codigo: "ENTREVISTA",
      rotulo: ITEM_DO_AJUSTE_POR_CODIGO.ENTREVISTA.rotulo,
      atual: candidato.notaEntrevista ?? null,
      calculado: ordens.length > 0,
      grupo: null,
    });
  }
  if (componentes.includes("ART"))
    itens.push({
      codigo: "ART",
      rotulo: ITEM_DO_AJUSTE_POR_CODIGO.ART.rotulo,
      atual: candidato.notaArt ?? null,
      calculado: false,
      grupo: null,
    });
  return itens;
}

const arredondar4 = (v) => Math.round(v * 10000) / 10000;
const igual = (a, b) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 1e-9;
const texto = (v) => String(v ?? "").trim();

/**
 * O rascunho aplicado aos itens: `{ valores: { codigo: "7,5" },
 * justificativas: { codigo: "…" } }` → `[{ ...item, novo, mudou, invalido,
 * justificativa }]`. Campo vazio = sem mudança; os totais calculados somam a
 * diferença dos componentes do grupo.
 */
export function montarItens(itens, rascunho = {}) {
  const valores = rascunho.valores || {};
  const justificativas = rascunho.justificativas || {};
  const montados = itens.map((item) => {
    const bruto = texto(valores[item.codigo]);
    const lido = bruto ? numeroBR(bruto) : null;
    const invalido =
      !item.calculado &&
      Boolean(bruto) &&
      (lido === null ||
        lido < LIMITES_DO_AJUSTE.valor.minimo ||
        lido > LIMITES_DO_AJUSTE.valor.maximo);
    const novo = item.calculado || !bruto || invalido ? item.atual : lido;
    return {
      ...item,
      novo,
      invalido,
      justificativa: texto(justificativas[item.codigo]),
    };
  });
  for (const total of montados.filter((i) => i.calculado)) {
    const doGrupo = montados.filter((i) => i.grupo === total.codigo);
    const diferenca = doGrupo.reduce(
      (soma, i) =>
        i.novo === null || igual(i.novo, i.atual)
          ? soma
          : soma + (i.novo - (i.atual ?? 0)),
      0,
    );
    if (Math.abs(diferenca) > 1e-9) {
      total.novo = arredondar4((total.atual ?? 0) + diferenca);
      total.justificativa = total.justificativa || JUSTIFICATIVA_DO_TOTAL;
    }
  }
  return montados.map((i) => ({
    ...i,
    mudou: i.novo !== null && !igual(i.novo, i.atual),
  }));
}

/** Os erros do rascunho (vazio = pode propor). */
export function validarAjuste(montados, justificativaGeral = "") {
  const erros = [];
  const geral = texto(justificativaGeral);
  const invalidos = montados.filter((i) => i.invalido);
  if (invalidos.length)
    erros.push(
      `Valor de 0 a 1000 em: ${invalidos.map((i) => i.rotulo).join(", ")}.`,
    );
  const mudados = montados.filter((i) => i.mudou);
  if (!mudados.length) erros.push("Altere ao menos um valor.");
  if (mudados.some((i) => i.novo < 0 || i.novo > 1000))
    erros.push("O total calculado fica fora de 0 a 1000.");
  if (geral.length > LIMITES_DO_AJUSTE.justificativa.maximo)
    erros.push("A justificativa geral passa de 4.000 caracteres.");
  if (
    montados.some(
      (i) =>
        i.justificativa.length > LIMITES_DO_AJUSTE.itemJustificativa.maximo,
    )
  )
    erros.push("Justificativa de componente com mais de 2.000 caracteres.");
  const semJustificativa = mudados.filter(
    (i) => i.justificativa.length < LIMITES_DO_AJUSTE.itemJustificativa.minimo,
  );
  if (
    mudados.length &&
    geral.length < LIMITES_DO_AJUSTE.justificativa.minimo &&
    semJustificativa.length
  )
    erros.push(
      "Escreva a justificativa geral ou a de cada componente alterado (10 caracteres ou mais).",
    );
  return erros;
}

/** Os itens que vão para propor_ajuste_pontuacao: só os que mudaram. */
export function itensParaEnviar(montados) {
  return montados
    .filter((i) => i.mudou)
    .map((i) => ({
      codigo: i.codigo,
      anterior: i.atual,
      novo: i.novo,
      ...(i.justificativa ? { justificativa: i.justificativa } : {}),
    }));
}

function resumoDe(explicacao) {
  if (!explicacao) return { naLista: false };
  return {
    naLista: true,
    elegivel: explicacao.elegivel,
    nota: explicacao.elegivel ? explicacao.nota : null,
    posicao: explicacao.elegivel ? (explicacao.posicaoGeral ?? null) : null,
    situacao: explicacao.situacao ?? null,
    motivo: explicacao.motivo ?? null,
  };
}

const MAXIMO_DE_AFETADOS = 10;

/**
 * A prévia: a classificação de agora (ajustes aprovados) × a com o ajuste
 * deste recurso no lugar do aprovado dele (se houver), na lista `tipo`.
 * Devolve `{ tipo, vaga, antes, depois, mudou, afetados, totalAfetados }`
 * — pronto para gravar (json pequeno, só nome e posição).
 */
export function previaDoAjuste({
  dados,
  tipo,
  analiseId,
  recursoId,
  numero = null,
  itens = [],
}) {
  const aprovados = dados?.ajustes || [];
  const outros = aprovados.filter((a) => a.recurso_id !== recursoId);
  const proposto = {
    recurso_id: recursoId,
    numero,
    analise_id: analiseId,
    aprovado_em: "9999-12-31T23:59:59Z",
    itens,
  };
  const agora = classificarEdital(dados, tipo, aprovados);
  const depois = classificarEdital(dados, tipo, [...outros, proposto]);
  const a = agora.explicacoes[analiseId];
  const d = depois.explicacoes[analiseId];
  const vaga = (d || a)?.vaga ?? null;
  const resumoAntes = resumoDe(a);
  const resumoDepois = resumoDe(d);
  const afetados = [];
  if (vaga !== null) {
    const ids = new Set(
      [
        ...Object.values(agora.explicacoes),
        ...Object.values(depois.explicacoes),
      ]
        .filter((e) => e.vaga === vaga && e.analiseId !== analiseId)
        .map((e) => e.analiseId),
    );
    for (const id of ids) {
      const x = resumoDe(agora.explicacoes[id]);
      const y = resumoDe(depois.explicacoes[id]);
      if (
        x.posicao === y.posicao &&
        x.situacao === y.situacao &&
        x.elegivel === y.elegivel
      )
        continue;
      afetados.push({
        nome: (depois.explicacoes[id] || agora.explicacoes[id]).nome,
        antes: x.posicao,
        depois: y.posicao,
        situacaoAntes: x.situacao,
        situacaoDepois: y.situacao,
      });
    }
  }
  afetados.sort(
    (p, q) =>
      (p.depois ?? Number.MAX_SAFE_INTEGER) -
        (q.depois ?? Number.MAX_SAFE_INTEGER) ||
      p.nome.localeCompare(q.nome, "pt-BR"),
  );
  return {
    tipo,
    vaga,
    antes: resumoAntes,
    depois: resumoDepois,
    mudou:
      resumoAntes.posicao !== resumoDepois.posicao ||
      resumoAntes.elegivel !== resumoDepois.elegivel ||
      resumoAntes.situacao !== resumoDepois.situacao ||
      resumoAntes.naLista !== resumoDepois.naLista,
    afetados: afetados.slice(0, MAXIMO_DE_AFETADOS),
    totalAfetados: afetados.length,
  };
}
