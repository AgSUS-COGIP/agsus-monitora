/*
  Os passos de "Conduzir entrevistas › Preparar" (src/modulos/entrevistas/
  preparar.tsx), sem React: 1 Roteiro, 2 Banca, 3 Convocação e 4 Agenda,
  cada um com o estado (feito / pendente) e a lista do que falta, em frases
  curtas — no espírito do assistente da regra da Avaliação documental. E a
  agenda do edital por dia (a montada na Classificação › Agenda), só para ler.

  Nada aqui decide regra: o que falta na banca vem de `errosDaConfiguracao`
  (src/lib/conducao-de-entrevista.js), a convocação de
  src/lib/convocacao-da-entrevista.js e a agenda de `obter_agenda_entrevista`.
*/

import { rotuloDoDia } from "./fila-de-conducao.ts";

export type IdDoPasso = "roteiro" | "banca" | "convocacao" | "agenda";
export type EstadoDoPasso = "feito" | "pendente";

export type PassoDoPreparar = {
  id: IdDoPasso;
  rotulo: string;
  icone: string;
  estado: EstadoDoPasso;
  /** Uma linha do que está pronto ("Entrevista individual · v2"). */
  resumo: string;
  /** O que falta, em frases curtas (vazio quando feito). */
  falta: string[];
};

export type EntradaDosPassos = {
  roteiro: { nome?: string | null; rotuloDaVersao?: string } | null;
  /** Membros ativos da banca, já gravados. */
  membros: number;
  bancas: number;
  /** Mensagens de `errosDaConfiguracao` sobre a banca (cobertura, membros). */
  errosDaBanca: string[];
  convocacao: {
    /** Há lista de convocação gerada na Classificação. */
    temLista: boolean;
    naLista: number;
    naFicha: number;
    /** Da lista, ainda não convocados. */
    aConvocar: number;
  };
  agenda: {
    /** Convocados com horário na agenda salva. */
    comHorario: number;
    convocados: number;
  };
};

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

export const ROTULOS_DOS_PASSOS: Readonly<
  Record<IdDoPasso, { rotulo: string; icone: string }>
> = Object.freeze({
  roteiro: { rotulo: "Roteiro", icone: "fa-clipboard-check" },
  banca: { rotulo: "Banca", icone: "fa-users" },
  convocacao: { rotulo: "Convocação", icone: "fa-bullhorn" },
  agenda: { rotulo: "Agenda", icone: "fa-calendar-days" },
});

function passo(
  id: IdDoPasso,
  falta: string[],
  resumo: string,
): PassoDoPreparar {
  return {
    id,
    ...ROTULOS_DOS_PASSOS[id],
    estado: falta.length ? "pendente" : "feito",
    resumo,
    falta,
  };
}

/** Os quatro passos, na ordem, com o estado e o que falta em cada um. */
export function passosDoPreparar(e: EntradaDosPassos): PassoDoPreparar[] {
  const roteiro = e.roteiro
    ? passo(
        "roteiro",
        [],
        [e.roteiro.nome, e.roteiro.rotuloDaVersao].filter(Boolean).join(" · "),
      )
    : passo("roteiro", ["Escolha o roteiro da entrevista."], "");

  const faltaNaBanca: string[] = [];
  if (!e.membros) faltaNaBanca.push("Cadastre os membros da banca.");
  for (const erro of e.errosDaBanca)
    if (!faltaNaBanca.includes(erro)) faltaNaBanca.push(erro);
  const banca = passo(
    "banca",
    faltaNaBanca,
    e.membros
      ? `${plural(e.membros, "membro", "membros")} em ${plural(e.bancas, "banca", "bancas")}`
      : "",
  );

  const c = e.convocacao;
  const faltaNaConvocacao: string[] = [];
  if (!c.temLista)
    faltaNaConvocacao.push("Gere a lista de convocação na Classificação.");
  else if (!c.naLista)
    faltaNaConvocacao.push("A lista de convocação não tem candidatos.");
  else if (c.aConvocar)
    faltaNaConvocacao.push(
      c.naFicha
        ? `${plural(c.aConvocar, "candidato da lista ainda não foi convocado", "candidatos da lista ainda não foram convocados")}.`
        : `Convoque os ${plural(c.aConvocar, "candidato", "candidatos")} da lista.`,
    );
  const convocacao = passo(
    "convocacao",
    faltaNaConvocacao,
    c.naFicha ? plural(c.naFicha, "convocado", "convocados") : "",
  );

  const a = e.agenda;
  const faltaNaAgenda: string[] = [];
  if (!a.convocados)
    faltaNaAgenda.push("Convoque os candidatos antes de montar a agenda.");
  else if (!a.comHorario)
    faltaNaAgenda.push(
      "Monte a agenda na Classificação (dia, horário e banca de cada candidato).",
    );
  else if (a.comHorario < a.convocados)
    faltaNaAgenda.push(
      `${plural(a.convocados - a.comHorario, "convocado ainda está sem horário", "convocados ainda estão sem horário")}.`,
    );
  const agenda = passo(
    "agenda",
    faltaNaAgenda,
    a.comHorario ? `${plural(a.comHorario, "horário", "horários")}` : "",
  );

  return [roteiro, banca, convocacao, agenda];
}

/** O passo em que Preparar abre: o primeiro pendente (todos feitos: o 1º). */
export function passoInicial(passos: PassoDoPreparar[]): number {
  const i = passos.findIndex((p) => p.estado === "pendente");
  return i < 0 ? 0 : i;
}

/** "3 de 4 prontos". */
export function textoDoAndamento(passos: PassoDoPreparar[]): string {
  const feitos = passos.filter((p) => p.estado === "feito").length;
  return `${feitos} de ${passos.length} ${feitos === 1 ? "pronto" : "prontos"}`;
}

/* ── Agenda (só leitura) ───────────────────────────────────────────── */

export type ItemDaAgenda = {
  analise_id?: string | null;
  data?: string | null;
  inicio?: string | null;
  fim?: string | null;
  banca?: number | null;
};

export type ConvocadoDaAgenda = {
  id: string;
  analise_id?: string | null;
  candidato?: string | null;
  codigo?: string | null;
  vaga?: string | null;
};

export type LinhaDaAgenda = {
  id: string;
  nome: string;
  codigo: string;
  vaga: string;
  inicio: string;
  fim: string;
  banca: number | null;
};

export type DiaDaAgenda = {
  data: string;
  rotulo: string;
  linhas: LinhaDaAgenda[];
};

const texto = (valor: unknown) => String(valor ?? "").trim();

/**
 * A agenda dos convocados por dia (dias e horários em ordem, depois o nome) e
 * quem ainda está sem horário. Horário de quem não está mais convocado fica
 * de fora.
 */
export function agendaPorDia(
  agenda: { itens?: ItemDaAgenda[] | null } | null | undefined,
  convocados: ConvocadoDaAgenda[] | null | undefined,
  hoje: string,
): { dias: DiaDaAgenda[]; semHorario: ConvocadoDaAgenda[] } {
  const porAnalise = new Map(
    (convocados || [])
      .filter((c) => c.analise_id)
      .map((c) => [texto(c.analise_id), c]),
  );
  const comHorario = new Set<string>();
  const linhas: (LinhaDaAgenda & { data: string })[] = [];
  for (const item of agenda?.itens || []) {
    const c = porAnalise.get(texto(item.analise_id));
    const data = texto(item.data);
    if (!c || !data) continue;
    comHorario.add(c.id);
    linhas.push({
      id: c.id,
      data,
      nome: texto(c.candidato) || "Sem nome",
      codigo: texto(c.codigo),
      vaga: texto(c.vaga),
      inicio: texto(item.inicio).slice(0, 5),
      fim: texto(item.fim).slice(0, 5),
      banca: item.banca ?? null,
    });
  }
  linhas.sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.inicio.localeCompare(b.inicio) ||
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );
  const dias: DiaDaAgenda[] = [];
  for (const { data, ...linha } of linhas) {
    let dia = dias.find((d) => d.data === data);
    if (!dia) {
      dia = { data, rotulo: rotuloDoDia(data, hoje), linhas: [] };
      dias.push(dia);
    }
    dia.linhas.push(linha);
  }
  return {
    dias,
    semHorario: (convocados || []).filter((c) => !comHorario.has(c.id)),
  };
}

/* ── O que falta para salvar a configuração ────────────────────────── */

export type PendenciaDaConfiguracao = {
  chave: string;
  passo: "roteiro" | "banca";
  texto: string;
};

/**
 * Os erros de `errosDaConfiguracao` ({ campo: mensagem }) em frases para a
 * lista perto do Salvar, com o membro pelo nome ("Membro 2 (Ana): Origem: de
 * 2 a 80 caracteres.") e o passo onde se corrige.
 */
export function pendenciasDaConfiguracao(
  erros: Record<string, string>,
  avaliadores: { chave: string; nome?: string | null }[] = [],
): PendenciaDaConfiguracao[] {
  return Object.entries(erros).map(([chave, mensagem]) => {
    if (chave === "roteiro")
      return { chave, passo: "roteiro", texto: mensagem };
    const membro = /^avaliador\.([^.]+)\./.exec(chave);
    if (membro) {
      const i = avaliadores.findIndex((a) => a.chave === membro[1]);
      const nome = texto(avaliadores[i]?.nome);
      return {
        chave,
        passo: "banca",
        texto: `Membro ${i + 1}${nome ? ` (${nome})` : ""}: ${mensagem}`,
      };
    }
    if (chave.startsWith("banca"))
      return { chave, passo: "banca", texto: `Composição: ${mensagem}` };
    return { chave, passo: "banca", texto: mensagem };
  });
}
