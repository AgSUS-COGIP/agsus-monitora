/*
  A fila de "Conduzir entrevistas" (src/modulos/entrevistas/conduzir.tsx),
  sem React: os convocados do edital (payload de `obter_entrevistas_do_edital`)
  juntos com a agenda salva (`obter_agenda_entrevista`), a situação de cada um
  na fila, os recortes Hoje / Próximos / Todos, o filtro por vaga e o contador
  do dia ("7 de 12 hoje").

  Situação na fila (as cores são as da Avaliação documental; `tom` é o do
  `Selo` de src/ui/):
    - faltou       comparecimento "N" (amarelo);
    - concluida    parecer APTO ou INAPTO, ou todas as notas esperadas
                   lançadas (verde);
    - em_andamento compareceu ou já tem alguma nota (azul);
    - aguardando   nada lançado ainda (cinza).
  Concluída e faltou contam como "feitas" no contador do dia.

  O dia é o de Brasília (o mesmo da agenda). Quem não tem horário na agenda
  só aparece em Todos.
*/

import { competenciasDoAvaliador } from "./conducao-de-entrevista.js";

export type Situacao = "aguardando" | "em_andamento" | "concluida" | "faltou";
export type Recorte = "hoje" | "proximos" | "todos";

export type Avaliacao = {
  competencia?: string | null;
  avaliador?: string | null;
  aspecto?: string | null;
  aspectos?: { aspecto: string; nota: number | string | null }[] | null;
  nota?: number | string | null;
};

export type Convocado = {
  id: string;
  nota_analise?: number | null;
  justificativa?: string | null;
  observacoes?: { avaliador: string; texto?: string | null }[] | null;
  analise_id?: string | null;
  candidato?: string | null;
  codigo?: string | null;
  vaga?: string | null;
  cargo?: string | null;
  modalidade?: string | null;
  banca?: number | null;
  compareceu?: string | null;
  nota?: number | null;
  parecer?: string | null;
  avaliacoes?: Avaliacao[] | null;
};

export type Avaliador = {
  id: string;
  nome?: string | null;
  origem?: string | null;
  perfil?: string | null;
  banca?: number | string | null;
  ativo?: boolean;
  /** As competências que o membro avalia (nulo ou vazio = todas). */
  competencias?: string[] | null;
};

export type ItemDaAgendaNoBanco = {
  analise_id?: string | null;
  data?: string | null;
  inicio?: string | null;
  fim?: string | null;
  banca?: number | null;
};

export type DadosDaFila = {
  convocados?: Convocado[] | null;
  avaliadores?: Avaliador[] | null;
  configuracao?: {
    roteiro?: { competencias?: { id: string }[] | null } | null;
  } | null;
};

export type ItemDaFila = {
  id: string;
  convocado: Convocado;
  nome: string;
  vaga: string;
  data: string | null;
  inicio: string | null;
  fim: string | null;
  banca: number | null;
  situacao: Situacao;
  lancadas: number;
  esperadas: number;
};

export const SITUACOES: Readonly<
  Record<Situacao, { rotulo: string; tom: string }>
> = Object.freeze({
  aguardando: { rotulo: "Aguardando", tom: "neutro" },
  em_andamento: { rotulo: "Em andamento", tom: "revisar" },
  concluida: { rotulo: "Concluída", tom: "aprovado" },
  faltou: { rotulo: "Faltou", tom: "pendente" },
});

export const RECORTES: readonly { valor: Recorte; rotulo: string }[] =
  Object.freeze([
    { valor: "hoje", rotulo: "Hoje" },
    { valor: "proximos", rotulo: "Próximos" },
    { valor: "todos", rotulo: "Todos" },
  ]);

const texto = (valor: unknown) => String(valor ?? "").trim();
const temNota = (valor: unknown) =>
  valor !== null && valor !== undefined && valor !== "";

/** O dia de hoje em Brasília, "aaaa-mm-dd". */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

const PARTICULAS = /^(da|de|do|das|dos|di|du|del|e|y)$/i;

/**
 * As iniciais do avatar: a primeira letra do primeiro e do último NOME,
 * sem números, códigos nem partículas ("Ana Lúcia Terena" → "AT";
 * "Candidato Teste 03" → "CT"; "Maria das Dores" → "MD"; "Bruno" → "BR").
 * Sem nenhuma palavra com letra, as duas primeiras letras ou dígitos do
 * texto; vazio → "?".
 */
export function iniciais(nome: unknown): string {
  const bruto = texto(nome);
  const partes = bruto
    .split(/[\s\-–—_.,;/()]+/)
    // Palavra com número (código, "03", "2º") não é nome.
    .filter((p) => !/\p{N}/u.test(p))
    .map((p) => p.replace(/[^\p{L}'’]/gu, ""))
    .filter((p) => /\p{L}/u.test(p) && !PARTICULAS.test(p));
  if (!partes.length) {
    const resto = bruto.replace(/[^\p{L}\p{N}]/gu, "");
    return resto ? resto.slice(0, 2).toUpperCase() : "?";
  }
  const primeira = partes[0] ?? "";
  if (partes.length === 1)
    return [...primeira].slice(0, 2).join("").toUpperCase();
  const ultima = partes[partes.length - 1] ?? "";
  return `${[...primeira][0] ?? ""}${[...ultima][0] ?? ""}`.toUpperCase();
}

/**
 * Notas lançadas (pares competência × avaliador com nota; com aspectos,
 * conta o par uma vez) e esperadas: de cada avaliador da ficha, só as
 * competências que ele avalia (todas, por padrão).
 */
export function progressoDoConvocado(
  convocado: Convocado,
  avaliadores: Avaliador[] | null | undefined,
  competencias: { id: string }[] | null | undefined,
): { lancadas: number; esperadas: number } {
  const comNota = new Set(
    (convocado.avaliacoes || [])
      .filter((a) => temNota(a.nota))
      .map((a) => a.avaliador),
  );
  const daFicha = (avaliadores || []).filter((a) => {
    if (comNota.has(a.id)) return true;
    if (a.ativo === false) return false;
    return (
      convocado.banca === null ||
      convocado.banca === undefined ||
      Number(a.banca) === Number(convocado.banca)
    );
  });
  const devidas = new Set<string>();
  for (const a of daFicha)
    for (const c of competenciasDoAvaliador(a, competencias) as string[])
      devidas.add(`${c}|${a.id}`);
  const pares = new Set(
    (convocado.avaliacoes || [])
      .filter((a) => temNota(a.nota))
      .map((a) => `${texto(a.competencia)}|${texto(a.avaliador)}`)
      .filter((par) => devidas.has(par)),
  );
  return { lancadas: pares.size, esperadas: devidas.size };
}

export function situacaoDoConvocado(
  convocado: Convocado,
  progresso: { lancadas: number; esperadas: number },
): Situacao {
  if (texto(convocado.compareceu).toUpperCase() === "N") return "faltou";
  const parecer = texto(convocado.parecer).toUpperCase();
  if (parecer === "APTO" || parecer === "INAPTO") return "concluida";
  if (progresso.esperadas > 0 && progresso.lancadas >= progresso.esperadas)
    return "concluida";
  if (
    texto(convocado.compareceu).toUpperCase() === "S" ||
    progresso.lancadas > 0
  )
    return "em_andamento";
  return "aguardando";
}

const compararTexto = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base" });

/** Por dia e horário (quem tem horário primeiro), depois pelo nome. */
export function ordenarFila(itens: ItemDaFila[]): ItemDaFila[] {
  return [...itens].sort((a, b) => {
    const comA = a.data ? 0 : 1;
    const comB = b.data ? 0 : 1;
    return (
      comA - comB ||
      compararTexto(a.data || "", b.data || "") ||
      compararTexto(a.inicio || "", b.inicio || "") ||
      compararTexto(a.nome, b.nome)
    );
  });
}

/** A fila do edital: cada convocado com o horário salvo na agenda (se houver). */
export function montarFila(
  dados: DadosDaFila | null | undefined,
  agenda: { itens?: ItemDaAgendaNoBanco[] | null } | null | undefined,
): ItemDaFila[] {
  const horarios = new Map(
    (agenda?.itens || [])
      .filter((i) => i.analise_id)
      .map((i) => [texto(i.analise_id), i]),
  );
  const competencias = dados?.configuracao?.roteiro?.competencias || [];
  return ordenarFila(
    (dados?.convocados || []).map((c) => {
      const h = c.analise_id ? horarios.get(texto(c.analise_id)) : undefined;
      const progresso = progressoDoConvocado(
        c,
        dados?.avaliadores,
        competencias,
      );
      return {
        id: c.id,
        convocado: c,
        nome: texto(c.candidato) || "Sem nome",
        vaga: texto(c.vaga),
        data: texto(h?.data) || null,
        inicio: texto(h?.inicio).slice(0, 5) || null,
        fim: texto(h?.fim).slice(0, 5) || null,
        banca: h?.banca ?? c.banca ?? null,
        situacao: situacaoDoConvocado(c, progresso),
        ...progresso,
      };
    }),
  );
}

const feita = (item: ItemDaFila) =>
  item.situacao === "concluida" || item.situacao === "faltou";

/** Quantos em cada recorte (para os rótulos do seletor). */
export function contagemDosRecortes(
  fila: ItemDaFila[],
  hoje: string,
): Record<Recorte, number> {
  return {
    hoje: fila.filter((i) => i.data === hoje).length,
    proximos: fila.filter((i) => i.data !== null && i.data > hoje).length,
    todos: fila.length,
  };
}

/**
 * O recorte em que a fila abre: Hoje, quando há entrevista hoje; senão
 * Próximos; senão Todos (edital sem agenda salva).
 */
export function recorteInicial(fila: ItemDaFila[], hoje: string): Recorte {
  const contagem = contagemDosRecortes(fila, hoje);
  if (contagem.hoje) return "hoje";
  if (contagem.proximos) return "proximos";
  return "todos";
}

/** Sem acento e em minúsculas, para a busca. */
export function semAcento(valor: unknown): string {
  return texto(valor).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * A busca da fila: cada palavra digitada aparece no nome, no código do
 * candidato ou no código da vaga (sem acento, sem diferença de maiúsculas).
 */
export function buscarNaFila(itens: ItemDaFila[], busca: string): ItemDaFila[] {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) return itens;
  return itens.filter((i) => {
    const alvo = semAcento(`${i.nome} ${i.convocado.codigo ?? ""} ${i.vaga}`);
    return termos.every((t) => alvo.includes(t));
  });
}

export type GrupoDaVaga = {
  vaga: string;
  cargo: string;
  itens: ItemDaFila[];
};

/**
 * Os cartões por vaga (cabeçalho "código · cargo" com a contagem), as vagas
 * em ordem de código; dentro de cada uma, a ordem da fila (horário, nome).
 * Sem código de vaga, o grupo "Sem vaga" fica no fim.
 */
export function agruparPorVaga(itens: ItemDaFila[]): GrupoDaVaga[] {
  const grupos = new Map<string, GrupoDaVaga>();
  for (const item of itens) {
    const chave = item.vaga || "";
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { vaga: chave, cargo: texto(item.convocado.cargo), itens: [] };
      grupos.set(chave, grupo);
    }
    grupo.itens.push(item);
  }
  return [...grupos.values()].sort(
    (a, b) =>
      (a.vaga ? 0 : 1) - (b.vaga ? 0 : 1) ||
      a.vaga.localeCompare(b.vaga, "pt-BR", { numeric: true }),
  );
}

/** A ordem do "Salvar e abrir o próximo": a da tela (vaga a vaga). */
export function ordemDaTela(itens: ItemDaFila[]): ItemDaFila[] {
  return agruparPorVaga(itens).flatMap((g) => g.itens);
}

export function recortarFila(
  fila: ItemDaFila[],
  {
    recorte,
    vaga = "",
    hoje,
  }: { recorte: Recorte; vaga?: string; hoje: string },
): ItemDaFila[] {
  return fila.filter((i) => {
    if (vaga && i.vaga !== vaga) return false;
    if (recorte === "hoje") return i.data === hoje;
    if (recorte === "proximos") return i.data !== null && i.data > hoje;
    return true;
  });
}

/** As vagas da fila, em ordem. */
export function vagasDaFila(fila: ItemDaFila[]): string[] {
  return [...new Set(fila.map((i) => i.vaga).filter(Boolean))].sort(
    compararTexto,
  );
}

/** "7 de 12 hoje": as feitas (concluídas e faltas) entre as de hoje. */
export function contadorDoDia(
  fila: ItemDaFila[],
  hoje: string,
): { feitas: number; total: number; completo: boolean } {
  const doDia = fila.filter((i) => i.data === hoje);
  const feitas = doDia.filter(feita).length;
  return {
    feitas,
    total: doDia.length,
    completo: doDia.length > 0 && feitas === doDia.length,
  };
}

/** Quantos em cada situação, num recorte. */
export function resumoDasSituacoes(
  itens: ItemDaFila[],
): Record<Situacao, number> {
  const resumo: Record<Situacao, number> = {
    aguardando: 0,
    em_andamento: 0,
    concluida: 0,
    faltou: 0,
  };
  for (const item of itens) resumo[item.situacao] += 1;
  return resumo;
}

/** "Hoje", "Amanhã" ou "qua., 09/10". */
export function rotuloDoDia(data: string | null, hoje: string): string {
  if (!data) return "Sem horário";
  if (data === hoje) return "Hoje";
  const [a, m, d] = data.split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  if (!a || !m || !d || !ha || !hm || !hd) return data;
  const dia = Date.UTC(a, m - 1, d);
  const diferenca = Math.round((dia - Date.UTC(ha, hm - 1, hd)) / 86400000);
  if (diferenca === 1) return "Amanhã";
  const semana = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."][
    new Date(dia).getUTCDay()
  ];
  return `${semana}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
