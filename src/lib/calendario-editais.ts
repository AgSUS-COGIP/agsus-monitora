import type {
  CelulaDoCalendario,
  EditalComCronograma,
  FaixaDaSemana,
  EditalDoCalendario,
  EtapaDoCalendario,
  FiltrosDoCalendario,
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
  quais passam nos filtros e o que cada dia do mês mostra.

  UMA COR SÓ: A DO TIPO DE ETAPA. É a cor da legenda, da faixa no mês, da borda
  e da bolinha nas listas e do ponto na linha do tempo. A unidade é texto (sem
  cor própria): seis cores repetidas entre dezenas de DSEIs só competiam com a
  do tipo. O rótulo do tipo vai sempre escrito ao lado — a cor nunca é o único
  sinal.

  O MÊS MOSTRA FAIXAS LEGÍVEIS, COMO UMA AGENDA. Cada etapa é uma faixa
  "unidade – etapa" que atravessa os dias do intervalo, uma linha por semana
  (`faixasDaSemana`). Cada dia mostra até três faixas e "+N mais"; o dia inteiro
  abre o popup com tudo o que acontece nele. A versão anterior trocava os nomes
  por bolinhas com contagens, e ninguém sabia o que era cada uma sem clicar.
*/

import {
  TIPOS_DE_ETAPA,
  TIPO_OUTROS,
  classificarEtapa,
  dataLocal,
  etapaConcluida,
  normalizarTexto,
} from "./etapas-de-edital.ts";
import {
  editaisComDatasARevisar,
  etapaComDatasValidas,
  proximaDataDaEtapa,
  proximasEtapas as etapasNaOrdemDaProximaData,
} from "./datas-do-cronograma.ts";

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

/** O bloco compacto de próximas etapas, embaixo do Mês. */
export const PROXIMAS_NO_PAINEL = 5;

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

/** A posição do tipo na legenda: a ordem das etapas dentro de um dia. */
const ORDEM_DOS_TIPOS = new Map(
  TIPOS_DA_LEGENDA.map((tipo, indice) => [tipo.id, indice]),
);
const ordemDoTipo = (tipo: TipoDaEtapa) =>
  ORDEM_DOS_TIPOS.get(tipo.id) ?? TIPOS_DA_LEGENDA.length;

/** Dentro de um dia: pela ordem da legenda, depois pela unidade. */
export const pelaOrdemNoDia = (a: EtapaDoCalendario, b: EtapaDoCalendario) =>
  ordemDoTipo(a.tipo) - ordemDoTipo(b.tipo) ||
  a.unidade.localeCompare(b.unidade, "pt-BR") ||
  a.ordem - b.ordem;

/**
 * O nome da unidade sem o "DSEI " da frente, para caber na faixa do mês
 * ("DSEI Alto Rio Purus" → "Alto Rio Purus"). O nome inteiro fica no `title`.
 */
export function unidadeCurta(unidade: string) {
  const curta = unidade
    .replace(
      /^\s*(dsei|distrito sanit[aá]rio especial ind[ií]gena)\s*[-–—:]?\s+/i,
      "",
    )
    .trim();
  return curta || unidade;
}

/** "Ed. 112/2026" — o número como está guardado, sem inventar o ano. */
export function rotuloDoNumeroDoEdital(edital: string) {
  const numero = edital.replace(/^\s*ed(ital)?\.?\s+/i, "").trim();
  return `Ed. ${numero || edital}`;
}

/** "DSEI Alto Rio Purus · Ed. 112/2026 · 03/11 a 09/11 (7 dias)" */
export const detalheDaEtapa = (etapa: EtapaDoCalendario) =>
  `${etapa.unidade} · ${rotuloDoNumeroDoEdital(etapa.edital)} · ${periodoDaEtapa(etapa)}`;

/**
 * As 42 células da grade de `mes`. A grade começa no domingo da semana do dia 1
 * e tem sempre 6 linhas, para a altura não saltar quando se muda de mês.
 *
 * `total` conta as etapas ATIVAS no dia (começam, terminam ou atravessam), as
 * mesmas que o popup do dia lista. `pontos` traz os tipos presentes, na ordem
 * da legenda: é o resumo do celular, onde as faixas não cabem.
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
    const ativas = etapasAtivasNoDia(etapas, chave);

    const porTipo = new Map<string, { tipo: TipoDaEtapa; total: number }>();
    for (const { etapa } of ativas) {
      const atual = porTipo.get(etapa.tipo.id);
      if (atual) atual.total += 1;
      else porTipo.set(etapa.tipo.id, { tipo: etapa.tipo, total: 1 });
    }

    celulas.push({
      chave,
      dia: dia.getDate(),
      rotulo: `${dia.getDate()} de ${MESES[dia.getMonth()]?.toLowerCase()}: ${
        ativas.length
      } ${plural(ativas.length, "etapa", "etapas")}`,
      doMes: dia.getMonth() === primeiro.getMonth(),
      hoje: chave === hojeChave,
      total: ativas.length,
      pontos: [...porTipo.values()].sort(
        (a, b) => ordemDoTipo(a.tipo) - ordemDoTipo(b.tipo),
      ),
    });
  }
  return celulas;
}

/** Faixas visíveis por dia no mês; o resto vira "+N mais". */
export const FAIXAS_POR_DIA = 3;

/**
 * As faixas de uma linha da grade (`chaves`: os 7 dias da semana). Cada etapa
 * ativa na semana vira uma faixa da coluna em que entra à coluna em que sai,
 * numa altura (`faixa`) fixa na semana inteira — como numa agenda. A ordem de
 * empilhar é a de uma agenda: quem começa antes, depois quem dura mais, depois
 * a legenda e a unidade. Só voltam as faixas abaixo de `limite`; `ocultas[i]`
 * diz quantas ficaram de fora no dia `i`, para o "+N mais".
 */
export function faixasDaSemana(
  etapas: readonly EtapaDoCalendario[],
  chaves: readonly string[],
  limite = FAIXAS_POR_DIA,
) {
  const primeira = chaves[0] ?? "";
  const ultima = chaves[chaves.length - 1] ?? "";
  const pedacos: Omit<FaixaDaSemana, "faixa">[] = [];
  for (const etapa of etapas || []) {
    if (!etapaComDatasValidas(etapa)) continue;
    const inicio = etapa.data_inicio;
    const fim = etapa.data_fim || inicio;
    if (inicio > ultima || fim < primeira) continue;
    const de = chaves.findIndex((chave) => chave >= inicio);
    let ate = chaves.length - 1;
    while (ate > 0 && (chaves[ate] ?? "") > fim) ate -= 1;
    pedacos.push({
      etapa,
      de,
      ate,
      continuaAntes: inicio < primeira,
      continuaDepois: fim > ultima,
    });
  }
  pedacos.sort(
    (a, b) =>
      a.de - b.de ||
      b.ate - b.de - (a.ate - a.de) ||
      pelaOrdemNoDia(a.etapa, b.etapa),
  );

  const fimDaFaixa: number[] = [];
  const ocultas = chaves.map(() => 0);
  const faixas: FaixaDaSemana[] = [];
  for (const pedaco of pedacos) {
    let faixa = fimDaFaixa.findIndex((fim) => fim < pedaco.de);
    if (faixa < 0) faixa = fimDaFaixa.length;
    fimDaFaixa[faixa] = pedaco.ate;
    if (faixa < limite) faixas.push({ ...pedaco, faixa });
    else
      for (let coluna = pedaco.de; coluna <= pedaco.ate; coluna += 1)
        ocultas[coluna] = (ocultas[coluna] ?? 0) + 1;
  }
  return { faixas, ocultas };
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

// ── Lista e semana ───────────────────────────────────────────────────────

/*
  As vistas Lista e Semana. As chaves de dia são texto "AAAA-MM-DD" e se
  comparam como texto, como em `etapasDoDia`: nada de `Date` no meio, e por
  isso nada de fuso a empurrar uma etapa para o dia ao lado. Os `Date` que
  entram (hoje, o mês, a semana) viram chave pela data local (`chaveDoDia`).
*/

export type VisaoDoCalendario = "mes" | "semana" | "lista";

/** A marca da etapa num dia da Lista ou da Semana. */
export type MarcaNoDia = "começa" | "último dia" | "no dia" | "em andamento";

/** `dias` dias depois de `data` (ou antes, se negativo), ao meio-dia local. */
export function somarDias(data: Date, dias: number) {
  return new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate() + dias,
    12,
  );
}

/** O domingo da semana de `data`, ao meio-dia local (a grade começa no domingo). */
export const inicioDaSemana = (data: Date) => somarDias(data, -data.getDay());

/** As 7 chaves da semana que começa em `inicio`. */
export const chavesDaSemana = (inicio: Date) =>
  Array.from({ length: 7 }, (_, indice) =>
    chaveDoDia(somarDias(inicio, indice)),
  );

/** Primeira e última chave do mês de `mes`. */
export function intervaloDoMes(mes: Date) {
  const primeiro = primeiroDoMes(mes);
  const ultimo = new Date(primeiro.getFullYear(), primeiro.getMonth() + 1, 0);
  return { inicio: chaveDoDia(primeiro), fim: chaveDoDia(ultimo) };
}

/**
 * A marca da etapa no dia `chave`, ou `null` se ela não está ativa nele.
 * Começa e termina no mesmo dia: "no dia". Atravessa o dia: "em andamento".
 */
export function marcaNoDia(
  etapa: EtapaDoCalendario,
  chave: string,
): MarcaNoDia | null {
  const inicio = etapa.data_inicio;
  const fim = etapa.data_fim || inicio;
  if (!inicio || chave < inicio || chave > fim) return null;
  if (inicio === fim) return "no dia";
  if (chave === inicio) return "começa";
  if (chave === fim) return "último dia";
  return "em andamento";
}

/**
 * "Ter, 3 de novembro". O ano só aparece quando não é o de `anoDeReferencia`
 * (o de hoje): "Sex, 1 de janeiro de 2027".
 */
export function cabecalhoDoDiaDaLista(
  chave: string,
  anoDeReferencia = new Date().getFullYear(),
) {
  const data = dataLocal(chave);
  if (!data) return chave;
  const ano =
    data.getFullYear() === anoDeReferencia ? "" : ` de ${data.getFullYear()}`;
  return `${DIAS_SEMANA[data.getDay()]}, ${data.getDate()} de ${MESES[
    data.getMonth()
  ]?.toLowerCase()}${ano}`;
}

export type ItemDoDia = { etapa: EtapaDoCalendario; marca: MarcaNoDia };
export type DiaDaLista = { chave: string; titulo: string; itens: ItemDoDia[] };

/**
 * A Lista de `inicio` a `fim` (chaves, inclusivas): um grupo por dia em que
 * alguma etapa COMEÇA ou TERMINA, como na grade do mês. Os dias pelo meio de
 * um intervalo não repetem a etapa — quem está em andamento vai, uma vez só,
 * para `emAndamentoNoDia`. Etapas de data impossível ficam de fora.
 */
export function diasDaLista(
  etapas: readonly EtapaDoCalendario[],
  inicio: string,
  fim: string,
  anoDeReferencia = new Date().getFullYear(),
): DiaDaLista[] {
  const porDia = new Map<string, ItemDoDia[]>();
  const incluir = (chave: string, etapa: EtapaDoCalendario) => {
    if (chave < inicio || chave > fim) return;
    const marca = marcaNoDia(etapa, chave);
    if (!marca) return;
    const itens = porDia.get(chave);
    if (itens) itens.push({ etapa, marca });
    else porDia.set(chave, [{ etapa, marca }]);
  };
  for (const etapa of etapas || []) {
    if (!etapaComDatasValidas(etapa)) continue;
    incluir(etapa.data_inicio, etapa);
    if (etapa.data_fim && etapa.data_fim !== etapa.data_inicio)
      incluir(etapa.data_fim, etapa);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, itens]) => ({
      chave,
      titulo: cabecalhoDoDiaDaLista(chave, anoDeReferencia),
      itens: itens.sort((a, b) => pelaOrdemNoDia(a.etapa, b.etapa)),
    }));
}

/**
 * Etapas que atravessam o dia `chave`: começaram antes e terminam depois. É o
 * bloco "Em andamento" do topo da Lista — quem começa ou termina no próprio
 * dia já aparece no grupo dele. Pelo fim mais próximo.
 */
export function emAndamentoNoDia(
  etapas: readonly EtapaDoCalendario[],
  chave: string,
) {
  return (etapas || [])
    .filter(
      (etapa) =>
        etapaComDatasValidas(etapa) &&
        marcaNoDia(etapa, chave) === "em andamento",
    )
    .sort(
      (a, b) => a.data_fim.localeCompare(b.data_fim) || pelaOrdemNoDia(a, b),
    );
}

/** Etapas ativas no dia (começam, terminam ou atravessam), para a Semana. */
export function etapasAtivasNoDia(
  etapas: readonly EtapaDoCalendario[],
  chave: string,
) {
  const ativas: ItemDoDia[] = [];
  for (const etapa of etapas || []) {
    if (!etapaComDatasValidas(etapa)) continue;
    const marca = marcaNoDia(etapa, chave);
    if (marca) ativas.push({ etapa, marca });
  }
  // As pontas do dia primeiro; o que só atravessa vai para o fim da coluna.
  const peso = (marca: MarcaNoDia) => (marca === "em andamento" ? 1 : 0);
  return ativas.sort(
    (a, b) => peso(a.marca) - peso(b.marca) || pelaOrdemNoDia(a.etapa, b.etapa),
  );
}

/** Quantas etapas estão ativas em algum dia entre `inicio` e `fim`. */
export function contarEtapasNoIntervalo(
  etapas: readonly EtapaDoCalendario[],
  inicio: string,
  fim: string,
) {
  return (etapas || []).filter(
    (etapa) =>
      etapaComDatasValidas(etapa) &&
      etapa.data_inicio <= fim &&
      (etapa.data_fim || etapa.data_inicio) >= inicio,
  ).length;
}

export const rotuloDaContagemDaSemana = (total: number) =>
  `${total} ${plural(total, "etapa", "etapas")} na semana`;

/** "1 a 7 de novembro de 2026", ou "29 de novembro a 5 de dezembro de 2026". */
export function rotuloDaSemana(inicio: Date) {
  const fim = somarDias(inicio, 6);
  const mes = (data: Date) => MESES[data.getMonth()]?.toLowerCase();
  if (inicio.getFullYear() !== fim.getFullYear())
    return `${inicio.getDate()} de ${mes(inicio)} de ${inicio.getFullYear()} a ${fim.getDate()} de ${mes(fim)} de ${fim.getFullYear()}`;
  if (inicio.getMonth() !== fim.getMonth())
    return `${inicio.getDate()} de ${mes(inicio)} a ${fim.getDate()} de ${mes(fim)} de ${fim.getFullYear()}`;
  return `${inicio.getDate()} a ${fim.getDate()} de ${mes(fim)} de ${fim.getFullYear()}`;
}

/*
  A vista que abre: a última escolhida pela pessoa neste navegador, ou Mês no
  computador e Lista no celular (a grade de 7 colunas não cabe a 375px).
*/
export const CHAVE_DA_VISAO = "agsus:cronograma:visao";
const VISOES: readonly VisaoDoCalendario[] = ["mes", "semana", "lista"];

export const visaoValida = (valor: unknown): valor is VisaoDoCalendario =>
  VISOES.includes(valor as VisaoDoCalendario);

export function visaoInicial(
  guardada: unknown,
  celular: boolean,
): VisaoDoCalendario {
  if (visaoValida(guardada)) return guardada;
  return celular ? "lista" : "mes";
}
