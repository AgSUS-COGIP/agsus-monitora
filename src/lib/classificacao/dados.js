/*
  O que a tela de Classificação precisa em volta do motor, sem DOM:
  - a data de corte da idade a partir do cronograma do edital (o fim do
    período de inscrição; com prorrogação, o fim mais tarde);
  - os indicadores (KPIs) de um resultado;
  - o recorte da tela (vaga, lista, busca pelo nome) sobre o resultado;
  - os avisos agrupados por tipo, para o topo;
  - a lista em que a tela abre, pela fase do edital.
*/
import { semAcento } from "./catalogo.js";
import { lerData, numeroBR } from "./numeros.js";

/** "AAAA-MM-DD" do fim das inscrições, ou null. */
export function dataDeCorteDoCronograma(cronograma = []) {
  let corte = null;
  for (const etapa of cronograma || []) {
    const nome = semAcento(etapa?.atividade);
    if (!/inscri/.test(nome) || /resultado|recurso|homolog|deferid/.test(nome))
      continue;
    const fim = lerData(etapa?.fim)
      ? String(etapa.fim).slice(0, 10)
      : lerData(etapa?.inicio)
        ? String(etapa.inicio).slice(0, 10)
        : null;
    if (fim && (!corte || fim > corte)) corte = fim;
  }
  return corte;
}

export const ROTULOS_DOS_AVISOS = Object.freeze({
  EMPATE_PENDENTE: "Empate aguardando sorteio ou decisão",
  SEM_DATA_CORTE: "Sem data de corte da idade",
  NUMERO_INVALIDO: "Número inválido",
  ENTREVISTA_SEM_ANALISE: "Entrevista sem análise ligada",
  CONVOCADO_SEM_ENTREVISTA: "Convocado sem entrevista lançada",
  ENTREVISTADO_NAO_HABILITADO: "Entrevistado sem habilitação documental",
  SEM_NOTA_ENTREVISTA: "Entrevista sem nota",
  SEM_NOTAS_COMPETENCIA: "Sem notas por competência",
  DADO_FALTANDO: "Dado faltando para um critério",
  COMPONENTE_FALTANDO: "Componente da nota faltando",
  EMPATE_NO_LIMITE: "Empate no limite",
  VAGA_SEM_QUADRO: "Vaga sem quadro de vagas",
  NIVEL_DESCONHECIDO: "Nível da vaga não identificado",
  MODALIDADE_DESCONHECIDA: "Modalidade não informada",
  INSCRICAO_SEM_CODIGO: "Sem código de inscrição",
  ENTREVISTA_PELO_NOME: "Entrevista ligada pelo nome",
  ENTREVISTA_REPETIDA: "Entrevista repetida",
  DESEMPATE_OBSOLETO: "Desempate registrado que não vale mais",
});

const PESO_DO_TOM = { danger: 0, warning: 1, info: 2 };

/** Os avisos agrupados por código, do mais grave: `[{ codigo, rotulo, tom, itens }]`. */
export function avisosAgrupados(avisos = []) {
  const grupos = new Map();
  for (const a of avisos) {
    if (!grupos.has(a.codigo))
      grupos.set(a.codigo, {
        codigo: a.codigo,
        rotulo: ROTULOS_DOS_AVISOS[a.codigo] || a.codigo,
        tom: a.tom || "info",
        itens: [],
      });
    grupos.get(a.codigo).itens.push(a);
  }
  return [...grupos.values()].sort(
    (a, b) =>
      (PESO_DO_TOM[a.tom] ?? 3) - (PESO_DO_TOM[b.tom] ?? 3) ||
      b.itens.length - a.itens.length,
  );
}

/** Os KPIs de um resultado. */
export function indicadoresDoResultado(resultado) {
  if (!resultado)
    return {
      candidatos: 0,
      elegiveis: 0,
      eliminados: 0,
      vagas: 0,
      avisos: 0,
      pendencias: 0,
    };
  return { ...resultado.totais };
}

/* O recorte da tela: vaga (chave), lista ("geral" ou modalidade) e busca pelo nome. */
export const RECORTE_VAZIO = Object.freeze({
  vaga: "",
  lista: "geral",
  busca: "",
});

export function recortarResultado(resultado, recorte = RECORTE_VAZIO) {
  if (!resultado) return [];
  const busca = semAcento(recorte.busca).trim();
  const casa = (nome) => !busca || semAcento(nome).includes(busca);
  return resultado.vagas
    .filter((v) => !recorte.vaga || v.chave === recorte.vaga)
    .map((v) => {
      const linhas =
        recorte.lista === "geral"
          ? v.geral
          : v.porModalidade[recorte.lista] || [];
      return {
        ...v,
        linhas: linhas.filter((l) => casa(l.nome)),
        eliminadosFiltrados: v.eliminados.filter((e) => casa(e.nome)),
      };
    })
    .filter((v) => !busca || v.linhas.length || v.eliminadosFiltrados.length);
}

/** Quantos filtros estão ativos (para o painel recolhível). */
export function filtrosAtivosDoRecorte(recorte) {
  return [
    recorte.vaga,
    recorte.lista !== "geral" ? recorte.lista : "",
    recorte.busca.trim(),
  ].filter(Boolean).length;
}

/**
 * A lista em que a tela abre: o resultado final quando já há nota de
 * entrevista lançada; senão a preliminar (o edital ainda está na avaliação
 * documental ou nas entrevistas, e o final sairia vazio).
 */
export function listaDaFase(dados) {
  const comNota = (dados?.entrevistas || []).some(
    (e) => numeroBR(e?.nota) !== null,
  );
  return comNota ? "FINAL" : "PRELIMINAR";
}
