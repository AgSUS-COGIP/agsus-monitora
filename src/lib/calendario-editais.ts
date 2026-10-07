import type {
  CelulaDoCalendario,
  EditalComCronograma,
  EditalDoCalendario,
  EtapaDoCalendario,
  FiltrosDoCalendario,
  MarcoDaEtapa,
  TipoDaEtapa,
} from "../modulos/cronograma/tipos.ts";

/** Guarda usada nas fronteiras das respostas JSON. */
export function registroDoCalendario(valor: unknown): Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
/*
  Calendário de Editais — a lógica, sem DOM nem rede.

  A tela (`src/modulos/cronograma/`) só desenha o que sai daqui, e o
  carregamento (`estado.ts` de lá) só entrega as linhas cruas das RPCs. O que
  fica neste arquivo é o que decide o que aparece: como as etapas viram dias,
  quais passam nos filtros e o que cada célula do mês conta.

  POR QUE O MÊS MOSTRA CONTAGENS E NÃO OS NOMES DAS ETAPAS.
  São perto de 800 etapas em cerca de uma centena de editais — umas doze por dia.
  A primeira versão escrevia o nome de cada uma dentro da célula do dia; o mês
  virava uma parede de cartões cortados a meio, e as etapas isoladas, que são as
  que alguém procura, desapareciam no meio das longas. Agora a célula mostra
  quantas etapas de cada tipo caem naquele dia, e o detalhe abre ao clicar. O mês
  passa a responder "onde é que há movimento" — que é o que uma vista de mês faz
  bem — e o painel de baixo responde "o que é, exatamente".

  Uma etapa com intervalo conta no dia em que COMEÇA e no dia em que TERMINA, não
  nos dias pelo meio. Um recurso de três semanas contado nos vinte e um dias
  empurrava para cima a contagem de todos eles e escondia o que era pontual.
*/

import {
  TIPOS_DE_ETAPA,
  TIPO_OUTROS,
  classificarEtapa,
  dataLocal,
  etapaConcluida,
  normalizarTexto,
} from "./etapas-de-edital.js";
import {
  editaisComDatasARevisar,
  etapaComDatasValidas,
  proximaDataDaEtapa,
  proximasEtapas as etapasNaOrdemDaProximaData,
} from "./datas-do-cronograma.js";

export { editaisComDatasARevisar };

export const MESES = Object.freeze([
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]);
export const DIAS_SEMANA = Object.freeze([
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
]);
const DIAS_EXTENSO = Object.freeze([
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
]);

/** A legenda e o filtro de tipo: os tipos conhecidos e, por último, "Outros". */
export const TIPOS_DA_LEGENDA = Object.freeze([...TIPOS_DE_ETAPA, TIPO_OUTROS]);

/** Etapas listadas no painel quando nenhum dia está escolhido. */
export const PROXIMAS_NO_PAINEL = 8;

export const FILTROS_VAZIOS: FiltrosDoCalendario = Object.freeze({
  unidade: "",
  edital: "",
  tipo: "",
  busca: "",
});

const txt = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
const numero = (valor: unknown) => {
  if (typeof valor !== "string" && typeof valor !== "number") return 0;
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};
const plural = (total: number, singular: string, varios: string) =>
  total === 1 ? singular : varios;

export const chaveDoDia = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;

export const primeiroDoMes = (data: Date) =>
  new Date(data.getFullYear(), data.getMonth(), 1);

export const somarMeses = (mes: Date, passo: number) =>
  new Date(mes.getFullYear(), mes.getMonth() + passo, 1);

export const rotuloDoMes = (mes: Date) =>
  `${MESES[mes.getMonth()]} ${mes.getFullYear()}`;

export function formatarCurto(data: Date | null) {
  return data
    ? `${String(data.getDate()).padStart(2, "0")}/${String(
        data.getMonth() + 1,
      ).padStart(2, "0")}`
    : "-";
}

/**
 * Roda `tarefa` sobre `itens` com no máximo `limite` em voo ao mesmo tempo.
 * Uma falha isolada não derruba o resto — devolve `null` naquela posição.
 */
export async function comLimite<T, R>(
  itens: readonly T[],
  limite: number,
  tarefa: (item: T, indice: number) => R | PromiseLike<R>,
): Promise<(R | null)[]> {
  const resultados: (R | null)[] = new Array(itens.length);
  const pendentes = itens.entries();
  async function trabalhador() {
    for (;;) {
      const proxima = pendentes.next();
      if (proxima.done) return;
      const [indice, item] = proxima.value;
      try {
        resultados[indice] = await tarefa(item, indice);
      } catch {
        resultados[indice] = null;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, trabalhador),
  );
  return resultados;
}

/** Só os editais que têm cronograma: os outros custariam uma chamada à toa. */
export function editaisComCronograma(resumo: unknown): EditalComCronograma[] {
  const linhas: readonly unknown[] = Array.isArray(resumo) ? resumo : [];
  const editais: EditalComCronograma[] = [];
  for (const linha of linhas) {
    const registro = registroDoCalendario(linha);
    const id = registro.id;
    const total = numero(registro.cronograma_total);
    if (
      !(typeof id === "string" && id.trim()) &&
      !(typeof id === "number" && Number.isFinite(id))
    )
      continue;
    if (!Number.isFinite(total) || total <= 0) continue;
    editais.push({
      id,
      unidade: txt(registro.unidade) || "Unidade não informada",
      edital: txt(registro.edital) || "Edital sem número",
      cronograma_total: total,
    });
  }
  return editais;
}

/**
 * Junta o resumo dos editais com as etapas de cada um (`blocos[i]` é a lista de
 * etapas do edital `editais[i]`, ou `null` se aquela chamada falhou).
 *
 */
export function montarEtapasDosEditais(
  editais: readonly EditalComCronograma[],
  blocos: readonly (readonly unknown[] | null)[],
) {
  const falhas = blocos.filter((bloco) => bloco === null).length;
  const etapas: EtapaDoCalendario[] = [];
  editais.forEach((edital, indice) => {
    for (const bruta of blocos[indice] || []) {
      const etapa = registroDoCalendario(bruta);
      // `slice(0, 10)` protege o caso de a coluna vir como timestamp: sem
      // isto a data ficaria "2026-09-29T00:00:00" e as comparações de dia,
      // que são por texto, deixariam de casar.
      const inicioTexto = txt(etapa?.data_inicio).slice(0, 10);
      if (!dataLocal(inicioTexto)) continue; // sem data não cabe num calendário
      const criada: EtapaDoCalendario = {
        busca: "",
        editalId: String(edital.id),
        unidade: txt(edital.unidade) || "Unidade não informada",
        edital: txt(edital.edital) || "Edital sem número",
        atividade: txt(etapa.atividade) || "Etapa sem nome",
        data_inicio: inicioTexto,
        data_fim: txt(etapa.data_fim).slice(0, 10) || inicioTexto,
        ordem: numero(etapa.ordem),
        tipo: classificarEtapa(txt(etapa.atividade)),
      };
      /*
        Texto pesquisável, já sem acentos, guardado na própria etapa: com ~800
        etapas e a busca a correr a cada tecla, normalizar três campos por
        etapa em cada filtragem era trabalho repetido à toa.
      */
      criada.busca = normalizarTexto(
        `${criada.atividade} ${criada.edital} ${criada.unidade}`,
      );
      etapas.push(criada);
    }
  });

  etapas.sort(
    (a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.ordem - b.ordem,
  );
  return {
    etapas,
    editais: editais.map((edital) => ({
      id: String(edital.id),
      unidade: txt(edital.unidade) || "Unidade não informada",
      edital: txt(edital.edital) || "Edital sem número",
    })),
    falhas,
  };
}

// ── Filtros ──────────────────────────────────────────────────────────────

/**
 * @param {Array} etapas
 * @param {{unidade?: string, edital?: string, tipo?: string, busca?: string}} filtros
 * @param {{ocultarConcluidas?: boolean, hoje?: Date}} [opcoes]
 */
export function filtrarEtapas(
  etapas: readonly EtapaDoCalendario[],
  filtros: Partial<FiltrosDoCalendario> = FILTROS_VAZIOS,
  opcoes: { ocultarConcluidas?: boolean; hoje?: Date } = {},
) {
  const { unidade, edital, tipo, busca } = { ...FILTROS_VAZIOS, ...filtros };
  const hoje = opcoes.hoje || new Date();
  // Cada palavra tem de aparecer, em qualquer ordem: "entrevista manaus" acha
  // o que "manaus entrevista" acha.
  const termos = normalizarTexto(busca).split(/\s+/).filter(Boolean);
  return (etapas || []).filter((etapa) => {
    if (unidade && etapa.unidade !== unidade) return false;
    if (edital && etapa.editalId !== edital) return false;
    if (tipo && etapa.tipo.id !== tipo) return false;
    if (termos.length && !termos.every((termo) => etapa.busca.includes(termo)))
      return false;
    if (opcoes.ocultarConcluidas && etapaConcluida(etapa, hoje)) return false;
    return true;
  });
}

/*
  Etapas que COMEÇAM ou TERMINAM no dia — não as que apenas o atravessam.
  `marco` fica vazio quando a etapa dura um dia só, que é começo e fim.
*/
export function etapasDoDia(
  etapas: readonly EtapaDoCalendario[],
  chave: string,
) {
  const doDia: { etapa: EtapaDoCalendario; marco: MarcoDaEtapa }[] = [];
  for (const etapa of etapas || []) {
    const comeca = etapa.data_inicio === chave;
    const termina = etapa.data_fim === chave;
    if (!comeca && !termina) continue;
    doDia.push({
      etapa,
      marco: comeca && termina ? "" : comeca ? "início" : "fim",
    });
  }
  return doDia;
}

/** Editais que ainda têm alguma etapa depois dos filtros, na ordem original. */
export function editaisDoFiltro(
  editais: readonly EditalDoCalendario[],
  etapasFiltradas: readonly EtapaDoCalendario[],
) {
  const comEtapa = new Set(etapasFiltradas.map((etapa) => etapa.editalId));
  return (editais || []).filter((edital) => comEtapa.has(edital.id));
}

/*
  O seletor da linha do tempo obedece aos filtros, incluindo a busca. Com uma
  centena de editais, procurar um numa lista solta é o passo mais lento da
  tela; escrever "manaus" na busca deixa lá só os de Manaus. Se o edital
  escolhido sair do filtro, vale o primeiro que restou — em vez de o seletor
  ficar em branco a apontar para algo que já não está na lista.
*/
export function editalDaLinhaDoTempo(
  escolhido: string,
  editaisVisiveis: readonly EditalDoCalendario[],
) {
  if (!editaisVisiveis.length) return escolhido || "";
  return editaisVisiveis.some((edital) => edital.id === escolhido)
    ? escolhido
    : editaisVisiveis[0]?.id || "";
}

/** As unidades que existem nas etapas, em ordem alfabética. */
export function unidadesDasEtapas(etapas: readonly EtapaDoCalendario[]) {
  return [...new Set((etapas || []).map((etapa) => etapa.unidade))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}

export const rotuloDoEdital = (edital: EditalDoCalendario) =>
  `${edital.edital} — ${edital.unidade}`;

// ── Datas e textos ───────────────────────────────────────────────────────

/** Dias que o intervalo cobre, contando as duas pontas. */
export function duracaoEmDias(etapa: EtapaDoCalendario) {
  const inicio = dataLocal(etapa.data_inicio);
  const fim = dataLocal(etapa.data_fim);
  if (!inicio || !fim) return 1;
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1;
}

export function periodoDaEtapa(etapa: EtapaDoCalendario) {
  // Ano digitado errado (0202, 2206): a duração dava "(666205 dias)".
  if (!etapaComDatasValidas(etapa)) return "data a revisar no cronograma";
  const inicio = dataLocal(etapa.data_inicio);
  if (etapa.data_inicio === etapa.data_fim) return formatarCurto(inicio);
  const fim = dataLocal(etapa.data_fim);
  return `${formatarCurto(inicio)} a ${formatarCurto(fim)} (${duracaoEmDias(
    etapa,
  )} dias)`;
}

/** "Terça-feira, 29 de setembro — 3 etapas" */
export function tituloDoDia(chave: string, total: number) {
  const data = dataLocal(chave);
  if (!data) return "Etapas do dia";
  return `${DIAS_EXTENSO[data.getDay()]}, ${data.getDate()} de ${MESES[
    data.getMonth()
  ]?.toLowerCase()} — ${total} ${plural(total, "etapa", "etapas")}`;
}

// ── Grade do mês ─────────────────────────────────────────────────────────

/**
 * As 42 células da grade de `mes`. A grade começa no domingo da semana do dia 1
 * e tem sempre 6 linhas, para a altura não saltar quando se muda de mês.
 *
 * Cada célula traz uma bolinha por tipo presente, com o total. É o que
 * substitui a lista de nomes: mostra a natureza e o volume do dia numa linha.
 */
export function montarGradeDoMes(
  mes: Date,
  etapas: readonly EtapaDoCalendario[],
  { hoje = new Date() }: { hoje?: Date } = {},
): CelulaDoCalendario[] {
  const primeiro = primeiroDoMes(mes);
  const hojeChave = chaveDoDia(hoje);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());

  const celulas: CelulaDoCalendario[] = [];
  for (let i = 0; i < 42; i += 1) {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    const chave = chaveDoDia(dia);
    const doDia = etapasDoDia(etapas, chave);

    const porTipo = new Map<string, { tipo: TipoDaEtapa; total: number }>();
    for (const { etapa } of doDia) {
      const atual = porTipo.get(etapa.tipo.id);
      if (atual) atual.total += 1;
      else porTipo.set(etapa.tipo.id, { tipo: etapa.tipo, total: 1 });
    }

    celulas.push({
      chave,
      dia: dia.getDate(),
      rotulo: `${dia.getDate()} de ${MESES[dia.getMonth()]}: ${doDia.length} etapa(s)`,
      doMes: dia.getMonth() === primeiro.getMonth(),
      hoje: chave === hojeChave,
      total: doDia.length,
      pontos: [...porTipo.values()].sort((a, b) => b.total - a.total),
    });
  }
  return celulas;
}

/*
  Contagem do mês à vista, não do total filtrado: o número fica ao lado do nome
  do mês e tem de descrever o que está desenhado por baixo dele.
*/
export function contarEtapasNoMes(
  etapas: readonly EtapaDoCalendario[],
  mes: Date,
) {
  const prefixo = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
  return (etapas || []).filter(
    (etapa) =>
      etapa.data_inicio.startsWith(prefixo) ||
      etapa.data_fim.startsWith(prefixo),
  ).length;
}

export const rotuloDaContagem = (total: number) =>
  `${total} ${plural(total, "etapa", "etapas")} no mês`;

/*
  O painel fixo do rodapé: o que vem a seguir, independente do dia aberto.

  Pela próxima data que importa — início, se ainda vai começar; fim, se já
  está em andamento —, e não pelo início bruto: um recurso aberto desde agosto
  que termina amanhã é "amanhã", não "agosto". Etapas de data impossível (ano
  digitado errado) ficam de fora: não há como dizer quando vêm.
*/
export function proximasEtapas(
  etapas: readonly EtapaDoCalendario[],
  hoje = new Date(),
  limite = PROXIMAS_NO_PAINEL,
) {
  const hojeChave = chaveDoDia(hoje);
  return etapasNaOrdemDaProximaData(etapas || [], hojeChave, limite);
}

/** A data (início ou fim) a mostrar ao lado da etapa em "Próximas etapas". */
export function dataExibidaNasProximas(
  etapa: EtapaDoCalendario,
  hoje = new Date(),
) {
  if (!etapaComDatasValidas(etapa)) return null;
  return proximaDataDaEtapa(etapa, chaveDoDia(hoje));
}

/** Todas as etapas de um edital, na ordem do cronograma, sem filtro nenhum. */
export function etapasDoEdital(
  etapas: readonly EtapaDoCalendario[],
  editalId: string,
) {
  if (!editalId) return [];
  return (etapas || [])
    .filter((etapa) => etapa.editalId === editalId)
    .sort(
      (a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.ordem - b.ordem,
    );
}
