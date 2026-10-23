/*
  Chaves da automação (Configurações › Automação, só administrador global),
  sem React e sem banco: o que chega de `obter_chaves_da_automacao`
  (supabase/migrations/20261022190000_chaves_da_automacao.sql) vira uma lista
  de chaves com estado, última e próxima execução; e as regras do motivo.

  Uma chave por aba liga ou desliga o que roda sozinho: as tarefas do pg_cron
  da chave (o banco as desliga junto) e os pedidos da agenda dos robôs
  (FC_DISPARAR_ROBO não pede com a chave desligada). O "Rodar agora" do
  Status das atualizações continua, com confirmação.

  A PRÓXIMA EXECUÇÃO sai da agenda do pg_cron (cinco campos, em UTC, como o
  pg_cron do Supabase): `*`, número, faixa `a-b`, passo `*\/n` ou `a-b/n` e
  listas. Dia do mês e dia da semana restritos ao mesmo tempo valem "um ou
  outro", como no cron. Agenda fora disso (ex.: "30 seconds") não tem próxima.
*/

export interface ExecucaoDaTarefa {
  inicio: Date | null;
  fim: Date | null;
  situacao: string;
}
export interface TarefaDaChave {
  nome: string;
  agenda: string;
  ativa: boolean;
  ultima: ExecucaoDaTarefa | null;
}
export interface ChaveDaAutomacao {
  chave: string;
  nome: string;
  ligada: boolean;
  motivo: string;
  em: Date | null;
  por: string;
  tarefas: TarefaDaChave[];
  ultimoPedido: ExecucaoDaTarefa | null;
  ultimaPreClassificacao: ExecucaoDaTarefa | null;
}
export interface EventoDaChave {
  chave: string;
  ligada: boolean;
  motivo: string;
  em: Date | null;
  por: string;
  tarefas: string[];
}
export interface ChavesDaAutomacao {
  geradoEm: Date | null;
  cronDisponivel: boolean;
  chaves: ChaveDaAutomacao[];
  semChave: TarefaDaChave[];
  historico: EventoDaChave[];
}

export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;

/* Linhas do Status das atualizações que obedecem a uma chave (id da linha → chave). */
export const CHAVE_DA_LINHA: Readonly<Record<string, string>> = Object.freeze({
  entrevistas: "entrevistas",
  selecao: "selecao",
  conferencias: "conferencias",
  pre_classificacao: "pre_classificacao",
  classificacao_desempate: "classificacao",
  classificacao_calculo: "classificacao_calculo",
});

/* Quando a chave não tem tarefa no pg_cron: o que dispara a automação. */
const QUANDO_SEM_TAREFA: Readonly<Record<string, string>> = Object.freeze({
  pre_classificacao: "No fim de cada carga do robô da Empregare",
  robo_de_inscricoes: "Nenhum edital com agenda de inscrições",
  classificacao: "Quando uma lista é gerada na Classificação",
  classificacao_calculo: "Quando alguém clica em Gerar na Classificação",
});

const registro = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const registros = (valor: unknown) =>
  (Array.isArray(valor) ? valor : [])
    .filter((v) => v !== null && typeof v === "object" && !Array.isArray(v))
    .map(registro);
const texto = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
const data = (valor: unknown): Date | null => {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  if (valor === "") return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

function execucao(entrada: unknown): ExecucaoDaTarefa | null {
  const bruta = registro(entrada);
  const inicio = data(bruta.inicio);
  if (!inicio) return null;
  return { inicio, fim: data(bruta.fim), situacao: texto(bruta.situacao) };
}

function tarefa(entrada: Record<string, unknown>): TarefaDaChave | null {
  const nome = texto(entrada.nome);
  if (!nome) return null;
  return {
    nome,
    agenda: texto(entrada.agenda),
    ativa: entrada.ativa === true,
    ultima: execucao(entrada.ultima),
  };
}
const tarefas = (valor: unknown) =>
  registros(valor)
    .map(tarefa)
    .filter((t): t is TarefaDaChave => t !== null);

/** O payload de `obter_chaves_da_automacao`, conferido campo a campo. */
export function normalizarChaves(entrada: unknown): ChavesDaAutomacao {
  const dados = registro(entrada);
  const chaves = registros(dados.chaves)
    .map((c): ChaveDaAutomacao | null => {
      const chave = texto(c.chave);
      if (!chave) return null;
      return {
        chave,
        nome: texto(c.nome) || chave,
        ligada: c.ligada !== false,
        motivo: texto(c.motivo),
        em: data(c.em),
        por: texto(c.por),
        tarefas: tarefas(c.tarefas),
        ultimoPedido: execucao(c.ultimo_pedido),
        ultimaPreClassificacao: execucao(c.ultima_pre_classificacao),
      };
    })
    .filter((c): c is ChaveDaAutomacao => c !== null);
  const historico = registros(dados.historico)
    .map((h): EventoDaChave => ({
      chave: texto(h.chave),
      ligada: h.ligada === true,
      motivo: texto(h.motivo),
      em: data(h.em),
      por: texto(h.por),
      tarefas: (Array.isArray(h.tarefas) ? h.tarefas : [])
        .map(texto)
        .filter(Boolean),
    }))
    .filter((h) => h.chave);
  return {
    geradoEm: data(dados.gerado_em),
    cronDisponivel: dados.cron_disponivel !== false,
    chaves,
    semChave: tarefas(dados.sem_chave),
    historico,
  };
}

/** Motivo de 10 a 500 caracteres (sem contar os espaços das pontas). */
export function motivoValido(motivo: unknown) {
  const t = typeof motivo === "string" ? motivo.trim() : "";
  return t.length >= MOTIVO_MINIMO && t.length <= MOTIVO_MAXIMO;
}

/* ── Agenda do pg_cron ─────────────────────────────────────────────────── */

function valoresDoCampo(campo: string, min: number, max: number) {
  const valores = new Set<number>();
  for (const parte of campo.split(",")) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(parte);
    if (!m) return null;
    const [, faixa = "", passoBruto] = m;
    const passo = passoBruto ? Number(passoBruto) : 1;
    if (!passo) return null;
    let inicio = min;
    let fim = max;
    if (faixa !== "*") {
      const [a = "", b] = faixa.split("-");
      inicio = Number(a);
      fim = b === undefined ? (passoBruto ? max : inicio) : Number(b);
    }
    if (inicio < min || fim > max || inicio > fim) return null;
    for (let v = inicio; v <= fim; v += passo) valores.add(v);
  }
  return valores;
}

/** A próxima execução de uma agenda do pg_cron (UTC) depois de `agora`; `null` sem regra. */
export function proximaExecucao(agenda: unknown, agora = new Date()) {
  const campos = texto(agenda).split(/\s+/);
  if (campos.length !== 5) return null;
  const [cm = "", ch = "", cd = "", cmes = "", cs = ""] = campos;
  const minutos = valoresDoCampo(cm, 0, 59);
  const horas = valoresDoCampo(ch, 0, 23);
  const dias = valoresDoCampo(cd, 1, 31);
  const meses = valoresDoCampo(cmes, 1, 12);
  const semana = valoresDoCampo(cs, 0, 7);
  if (!minutos || !horas || !dias || !meses || !semana) return null;
  if (semana.has(7)) semana.add(0);
  const diaRestrito = cd !== "*";
  const semanaRestrita = cs !== "*";
  const listaDeHoras = [...horas].sort((a, b) => a - b);
  const listaDeMinutos = [...minutos].sort((a, b) => a - b);
  const inicio = Math.floor(agora.getTime() / 60000) * 60000 + 60000;
  const base = new Date(inicio);
  for (let d = 0; d <= 400; d += 1) {
    const dia = new Date(
      Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate() + d,
      ),
    );
    if (!meses.has(dia.getUTCMonth() + 1)) continue;
    const peloDia = dias.has(dia.getUTCDate());
    const pelaSemana = semana.has(dia.getUTCDay());
    const vale =
      diaRestrito && semanaRestrita
        ? peloDia || pelaSemana
        : peloDia && pelaSemana;
    if (!vale) continue;
    for (const h of listaDeHoras)
      for (const m of listaDeMinutos) {
        const quando = Date.UTC(
          dia.getUTCFullYear(),
          dia.getUTCMonth(),
          dia.getUTCDate(),
          h,
          m,
        );
        if (quando >= inicio) return new Date(quando);
      }
  }
  return null;
}

/* ── Visão de cada chave na tela ───────────────────────────────────────── */

const maisRecente = (lista: (ExecucaoDaTarefa | null)[]) =>
  lista
    .filter((e): e is ExecucaoDaTarefa => e !== null)
    .sort(
      (a, b) => (b.inicio?.getTime() ?? 0) - (a.inicio?.getTime() ?? 0),
    )[0] || null;

/** A última execução automática: a tarefa mais recente ou a pré-classificação do fim do robô. */
export function ultimaExecucao(chave: ChaveDaAutomacao) {
  return maisRecente([
    ...chave.tarefas.map((t) => t.ultima),
    chave.ultimaPreClassificacao,
  ]);
}

/** A próxima execução: a mais cedo das tarefas ativas; `null` com a chave desligada. */
export function proximaDaChave(chave: ChaveDaAutomacao, agora = new Date()) {
  if (!chave.ligada) return null;
  const proximas = chave.tarefas
    .filter((t) => t.ativa)
    .map((t) => proximaExecucao(t.agenda, agora))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  return proximas[0] || null;
}

/** Texto da próxima execução quando não há data (chave desligada ou sem tarefa). */
export function semProxima(chave: ChaveDaAutomacao) {
  if (!chave.ligada) return "Não roda enquanto estiver desligada";
  if (!chave.tarefas.length) return QUANDO_SEM_TAREFA[chave.chave] || "—";
  if (!chave.tarefas.some((t) => t.ativa)) return "Tarefas paradas no banco";
  return "—";
}

/**
 * Tarefas do pg_cron fora do estado da chave (alguém mexeu direto no banco):
 * ligadas com a chave desligada, ou paradas com a chave ligada.
 */
export function tarefasForaDaChave(chave: ChaveDaAutomacao) {
  return chave.tarefas.filter((t) => t.ativa !== chave.ligada);
}

/** Chave por tarefa do pg_cron (para o Status das atualizações). */
export function chavesPorTarefa(dados: ChavesDaAutomacao | null | undefined) {
  const mapa = new Map<string, ChaveDaAutomacao>();
  for (const chave of dados?.chaves || [])
    for (const t of chave.tarefas) mapa.set(t.nome, chave);
  return mapa;
}

/** A chave de uma linha do Status das atualizações, se houver. */
export function chaveDaLinha(
  dados: ChavesDaAutomacao | null | undefined,
  linha: string,
) {
  const id = Object.hasOwn(CHAVE_DA_LINHA, linha) ? CHAVE_DA_LINHA[linha] : "";
  return (id && dados?.chaves.find((c) => c.chave === id)) || null;
}

/** O que dizer quando o banco recusa a mudança. */
export function mensagemDaRecusa(erro: { code?: string; message?: string }) {
  if (erro.code === "42501")
    return "Só o administrador global liga ou desliga a automação.";
  if (erro.code === "55000")
    return "Outra pessoa já mudou esta automação. A lista foi atualizada.";
  if (erro.code === "PGRST202")
    return "O banco ainda não tem as chaves da automação (migration 20261022190000).";
  return erro.message || "Não foi possível mudar a automação.";
}
