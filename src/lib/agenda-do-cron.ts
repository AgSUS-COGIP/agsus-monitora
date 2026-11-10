/*
  Agenda do pg_cron, sem banco e sem React: o que as telas Status das
  atualizações e Automação precisam saber de uma agenda (`cron.job.schedule`).

  A AGENDA (cinco campos, em UTC, como o pg_cron do Supabase): `*`, número,
  faixa `a-b`, passo `*\/n` ou `a-b/n` e listas. Dia do mês e dia da semana
  restritos ao mesmo tempo valem "um ou outro", como no cron. Agenda fora disso
  (ex.: "30 seconds") não tem regra: as funções devolvem nulo.

  O QUE SAI DAQUI
    proximaExecucao     a próxima execução depois de agora
    maiorIntervaloMin   o maior intervalo entre duas execuções seguidas (a noite
                        sem carga, o fim de semana, o mês de 31 dias): é dele que
                        sai o prazo de atraso no Status (saude-das-cargas.ts)
    descreverAgenda     a agenda em português, no horário de Brasília
                        ("a cada 5 min", "todo dia às 6h", "às 8h10, 13h10 e 18h10")

  Assim o horário de cada tarefa fica num lugar só (o banco) e a tela não
  precisa repetir prazos e textos à mão quando a agenda muda.
*/

const MINUTO_MS = 60_000;
const DIA_MIN = 24 * 60;
/* Brasília não tem horário de verão desde 2019: UTC−3 o ano todo. */
const FUSO_DE_BRASILIA_MIN = -3 * 60;

export interface AgendaDoCron {
  minutos: number[];
  horas: number[];
  dias: Set<number>;
  meses: Set<number>;
  semana: Set<number>;
  diaRestrito: boolean;
  semanaRestrita: boolean;
}

const texto = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";

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

/** A agenda do pg_cron lida campo a campo; `null` fora da regra. */
export function lerAgenda(agenda: unknown): AgendaDoCron | null {
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
  return {
    minutos: [...minutos].sort((a, b) => a - b),
    horas: [...horas].sort((a, b) => a - b),
    dias,
    meses,
    semana,
    diaRestrito: cd !== "*",
    semanaRestrita: cs !== "*",
  };
}

const lida = (agenda: unknown) =>
  agenda !== null &&
  typeof agenda === "object" &&
  Array.isArray((agenda as AgendaDoCron).minutos)
    ? (agenda as AgendaDoCron)
    : lerAgenda(agenda);

/** A próxima execução de uma agenda do pg_cron (UTC) depois de `agora`; `null` sem regra. */
export function proximaExecucao(
  agenda: unknown,
  agora = new Date(),
): Date | null {
  const a = lida(agenda);
  if (!a) return null;
  const inicio =
    Math.floor(agora.getTime() / MINUTO_MS) * MINUTO_MS + MINUTO_MS;
  const base = new Date(inicio);
  for (let d = 0; d <= 400; d += 1) {
    const dia = new Date(
      Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate() + d,
      ),
    );
    if (!a.meses.has(dia.getUTCMonth() + 1)) continue;
    const peloDia = a.dias.has(dia.getUTCDate());
    const pelaSemana = a.semana.has(dia.getUTCDay());
    const vale =
      a.diaRestrito && a.semanaRestrita
        ? peloDia || pelaSemana
        : peloDia && pelaSemana;
    if (!vale) continue;
    for (const h of a.horas) {
      // No primeiro dia, as horas que já passaram nem entram.
      if (d === 0 && h < base.getUTCHours()) continue;
      for (const m of a.minutos) {
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
  }
  return null;
}

/*
  As execuções seguidas a partir de `agora`, o bastante para ver um ciclo
  inteiro: pelo menos 8 dias (a semana) e 13 execuções (o ano, nas mensais),
  com teto de 3000 (a cada minuto, o teto chega antes dos 8 dias, e tudo bem:
  o intervalo é sempre o mesmo).
*/
function execucoesSeguidas(a: AgendaDoCron, agora: Date) {
  const lista: Date[] = [];
  let atual: Date | null = proximaExecucao(a, agora);
  while (atual && lista.length < 3000) {
    lista.push(atual);
    const primeira = lista[0] as Date;
    const vistoMin = (atual.getTime() - primeira.getTime()) / MINUTO_MS;
    if (vistoMin >= 8 * DIA_MIN && lista.length >= 13) break;
    atual = proximaExecucao(a, atual);
  }
  return lista;
}

/**
 * O maior intervalo (min) entre duas execuções seguidas da agenda; `null` sem
 * regra ou com uma execução só (ex.: dia 29 de fevereiro).
 */
export function maiorIntervaloMin(
  agenda: unknown,
  agora = new Date(),
): number | null {
  const a = lida(agenda);
  if (!a) return null;
  const lista = execucoesSeguidas(a, agora);
  let maior: number | null = null;
  for (let i = 1; i < lista.length; i += 1) {
    const intervalo =
      ((lista[i] as Date).getTime() - (lista[i - 1] as Date).getTime()) /
      MINUTO_MS;
    if (maior === null || intervalo > maior) maior = intervalo;
  }
  return maior;
}

const horaDeBrasilia = (h: number, m: number) => {
  const total =
    (((h * 60 + m + FUSO_DE_BRASILIA_MIN) % DIA_MIN) + DIA_MIN) % DIA_MIN;
  const hora = Math.floor(total / 60);
  const minuto = total % 60;
  return { hora, minuto, total };
};

const textoDaHora = ({ hora, minuto }: { hora: number; minuto: number }) =>
  minuto ? `${hora}h${String(minuto).padStart(2, "0")}` : `${hora}h`;

const lista = (itens: string[]) =>
  itens.length > 1
    ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`
    : (itens[0] ?? "");

/*
  Muitos horários num minuto só (ex.: aos :05 de 15 horas do dia): as horas
  seguidas viram "de hora em hora das 18h05 às 7h05" (a faixa pode virar a
  meia-noite) e as soltas, "às 12h05". A faixa mais longa vem primeiro.
*/
function horasSeguidas(
  horarios: { hora: number; minuto: number; total: number }[],
) {
  const minuto = horarios[0]?.minuto ?? 0;
  const horas = new Set(horarios.map((h) => h.hora));
  const faixas: number[][] = [];
  for (const inicio of [...horas].sort((a, b) => a - b)) {
    if (horas.has((inicio + 23) % 24)) continue;
    const faixa = [inicio];
    while (horas.has(((faixa[faixa.length - 1] as number) + 1) % 24))
      faixa.push(((faixa[faixa.length - 1] as number) + 1) % 24);
    faixas.push(faixa);
  }
  if (!faixas.length) return "";
  const hora = (h: number) => textoDaHora({ hora: h, minuto });
  const partes = faixas
    .sort((a, b) => b.length - a.length)
    .flatMap((f) =>
      f.length >= 3
        ? [
            `de hora em hora das ${hora(f[0] as number)} às ${hora(f[f.length - 1] as number)}`,
          ]
        : f.map((h) => `às ${hora(h)}`),
    );
  return lista(partes);
}

/**
 * A agenda em português, no horário de Brasília: "a cada 5 min", "de hora em
 * hora", "todo dia às 6h", "às 8h10, 13h10 e 18h10". O que não cabe nessas
 * formas (dia da semana, dia do mês, mais de 6 horários) volta como está.
 */
export function descreverAgenda(agenda: unknown): string {
  const bruta = texto(agenda);
  const a = lerAgenda(agenda);
  if (!a) return bruta;
  if (a.diaRestrito || a.semanaRestrita || a.meses.size !== 12) return bruta;

  const todasAsHoras = a.horas.length === 24;
  // Minutos espaçados por igual, a toda hora: "a cada N min" / "de hora em hora".
  if (todasAsHoras) {
    if (a.minutos.length === 1) return "de hora em hora";
    const passo = (a.minutos[1] as number) - (a.minutos[0] as number);
    const regular = a.minutos.every(
      (m, i) => i === 0 || m - (a.minutos[i - 1] as number) === passo,
    );
    // Também na volta da hora (ex.: 7,9 não é "a cada 2 min").
    if (regular && a.minutos.length * passo === 60)
      return `a cada ${passo} min`;
    return bruta;
  }

  const horarios = a.horas
    .flatMap((h) => a.minutos.map((m) => horaDeBrasilia(h, m)))
    .sort((x, y) => x.total - y.total);
  if (horarios.length > 6)
    return a.minutos.length === 1 ? horasSeguidas(horarios) || bruta : bruta;
  const textos = horarios.map(textoDaHora);
  return horarios.length === 1
    ? `todo dia às ${textos[0]}`
    : `às ${lista(textos)}`;
}
