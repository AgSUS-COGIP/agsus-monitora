/*
  "Ritmo da análise" do Painel das análises, sem React e sem banco: o retrato de
  `obter_ritmo_da_analise` (migration 20261019170000) vira, por edital, quanto
  falta, quantas por dia (e por avaliador) são precisas até o prazo e se o
  ritmo atual chega lá. Datas sempre em "AAAA-MM-DD", no horário de Brasília.

  A ETAPA DA ANÁLISE NO CRONOGRAMA (o prazo)
    1. Se alguma etapa tem `tipo_atividade` de análise documental/curricular,
       vale ela.
    2. Senão, pelo nome (sem acento, minúsculo): "validação"/"verificação" da
       documentação, ou "análise"/"avaliação" documental, curricular ou de
       títulos. Ficam de fora as etapas de resultado, divulgação, publicação,
       recurso, espelho, convocação, prazo, solicitação e isenção — é assim que
       a "Divulgação do resultado preliminar…" e a "Submissão de recursos
       relativos à análise documental" não contam.
    3. Entre as que casam, em ordem: a primeira que ainda não terminou (fim ≥
       hoje); se todas já passaram, a última (o prazo vencido aparece).
    Sem cronograma, ou sem etapa que case: sem prazo (nada é inventado). O
    cronograma vem do banco a cada carga: mudou lá, o card acompanha.

  DIAS ÚTEIS
    Segunda a sexta, menos os feriados nacionais de data fixa (1/1, 21/4, 1/5,
    7/9, 12/10, 2/11, 15/11, 20/11, 25/12). Hoje conta se é dia útil e ainda é
    horário de trabalho (antes das 18h de Brasília). O prazo conta inteiro.

  RITMO ATUAL
    Média de concluídas nos últimos 3 dias com análise (dias com ao menos uma
    ficha concluída, antes de hoje; hoje entra só depois das 18h). Sem esses
    dias: sem ritmo (sem projeção). Projeção: hoje ainda rende o que falta para
    a média (média − concluídas hoje); o resto, a média por dia útil seguinte.

  AVALIADORES
    A equipe do edital (analistas ativos em RL_ANALISTA_EDITAL): é quem a
    coordenação escalou e não oscila com quem faltou num dia. Sem equipe
    cadastrada, quem concluiu ficha nos últimos 7 dias.

  QUE EDITAIS APARECEM
    O banco manda os da área com a avaliação documental no MONITORA e fichas
    no lote. Ainda assim, edital sem nenhuma concluída e com o prazo da etapa
    já vencido sai: não há ritmo a acompanhar.

  AS CONTAGENS SÃO AS DO RESUMO DO PAINEL (19/10/2026)
    O card mostrava as fichas ao vivo e os KPIs do topo vêm do resumo do
    Painel (private."TA_PAINEL_ANALISE", remontado a cada 30 min): o usuário
    via 1.076 pendentes no topo e "faltam 1.074" no card. Agora o card conta
    as linhas do edital no mesmo resumo que a tela já recebeu
    (`noMomentoDoResumo`), sem nova consulta: faltam = Pendente + Em análise
    + Revisar; concluídas = Aprovado + Reprovado (a ficha publica assim; a
    fora do lote nem entra no painel). As concluídas de hoje também saem do
    resumo (data da análise = hoje), para a projeção não somar o que o resumo
    ainda não tem; as dos dias anteriores, a equipe e o cronograma continuam
    vindo de `obter_ritmo_da_analise`. Sem linhas do edital no resumo carregado
    (escopo "Inativo", por exemplo), o card dele não aparece. O momento é o do
    "Conferido às" do topo (`textoDoMomento`).

  DESTAQUES DE HOJE (21/10/2026)
    Medalhas para quem concluiu fichas hoje (horário de Brasília), por edital:
    🥇🥈🥉 para as três maiores contagens do dia; empate leva a mesma medalha
    (as contagens 30, 30, 25, 20 dão ouro, ouro, prata e bronze). Selo
    "Precisão" (🎯) para quem concluiu ao menos `MINIMO_DO_SELO` (10) fichas
    hoje sem nenhuma reaberta: reabertura (REABRIR, pela coordenação ou pela
    própria pessoa) registrada hoje de uma ficha que ela concluiu hoje —
    REINICIAR não conta (migration 20261021100000). Zera todo dia: o retrato
    traz o dia e, virou a data com a tela aberta, o bloco some até a próxima
    carga. Sem ranking acumulado e sem a contagem de quem ficou fora do
    pódio: o banco só manda os do pódio e os que chegaram ao mínimo do selo,
    e a tela só mostra medalhistas e selos.

  COMEMORAÇÃO DA EQUIPE
    Quando o selo do dia vira "Meta de hoje batida", a tela solta a
    comemoração (marco "meta-do-dia" do catálogo, que respeita Configurações ›
    Comemorações, a preferência pessoal e o prefers-reduced-motion) uma vez
    por dia por pessoa: o dia fica guardado neste navegador
    (`lerMetaComemorada`/`gravarMetaComemorada`).
*/

import { quandoFoi } from "./texto-da-conferencia.js";

export interface EtapaDoCronograma {
  ordem: number;
  atividade: string;
  tipo: string | null;
  inicio: string | null;
  fim: string | null;
}

export interface SituacoesDasFichas {
  pendente: number;
  em_analise: number;
  revisar: number;
  concluida: number;
  fora_lote: number;
}

/** Quem concluiu fichas hoje e entrou no retrato (pódio ou mínimo do selo). */
export interface AvaliadorDoDia {
  nome: string;
  /** Fichas concluídas hoje (só aparece na tela para medalhistas). */
  qt: number;
  /** Fichas concluídas hoje e reabertas hoje. */
  reabertas: number;
}

export interface DestaquesDoRetrato {
  dia: string;
  avaliadores: readonly AvaliadorDoDia[];
}

export interface Medalhista {
  nome: string;
  qt: number;
  /** 1 = ouro, 2 = prata, 3 = bronze (empate: a mesma). */
  posicao: 1 | 2 | 3;
}

export interface DestaquesDeHoje {
  medalhas: readonly Medalhista[];
  /** Nomes com o selo "Precisão". */
  precisao: readonly string[];
}

export interface EditalDoRitmo {
  id: string;
  edital: string;
  situacoes: SituacoesDasFichas;
  porDia: readonly { dia: string; qt: number }[];
  qtEquipe: number;
  qtAvaliadoresRecentes: number;
  cronograma: readonly EtapaDoCronograma[];
  /** Destaques de hoje (migration 20261021100000); null sem o campo. */
  destaques?: DestaquesDoRetrato | null;
}

export type SituacaoDoRitmo =
  | "concluido"
  | "no-ritmo"
  | "abaixo"
  | "vencido"
  | "sem-prazo"
  | "sem-historico";

export interface RitmoDoEdital {
  id: string;
  edital: string;
  etapa: { nome: string; atividade: string; fim: string } | null;
  concluidas: number;
  faltam: number;
  percentual: number;
  diasRestantes: number;
  porDia: number | null;
  avaliadores: number;
  avaliadoresDaEquipe: boolean;
  porAvaliador: number | null;
  ritmo: number | null;
  diasDoRitmo: number;
  concluidasHoje: number;
  termino: string | null;
  diasDeAtraso: number;
  situacao: SituacaoDoRitmo;
  /** O bloco "Hoje": meta do dia, feito, faltam e o selo que oscila. */
  dia: RitmoDoDia;
  /** Medalhas e selos de hoje (vazios se o retrato não é de hoje). */
  destaques: DestaquesDeHoje;
}

export type SituacaoDoDia =
  "nao-util" | "sem-meta" | "batida" | "no-ritmo" | "abaixo";

export interface RitmoDoDia {
  situacao: SituacaoDoDia;
  /** (faltam + feito hoje) ÷ dias úteis até o prazo, contando hoje. */
  meta: number;
  /** Concluídas desde 00:00 de Brasília (no momento do resumo). */
  feito: number;
  /** max(meta − feito, 0). */
  faltam: number;
  /** Faltam hoje ÷ avaliadores (para cima); null sem faltar ou sem avaliadores. */
  porAvaliador: number | null;
  /** Meta × fração do expediente já decorrida. */
  esperado: number;
  /** O que passou da meta. */
  excedente: number;
}

export interface Agora {
  hoje: string;
  hora: number;
  /** Os minutos da hora (o selo do dia anda ao longo da hora); 0 se faltar. */
  minuto?: number;
}

/** O expediente em Brasília: 08:00–18:00 (o esperado do dia anda nele). */
export const INICIO_DO_EXPEDIENTE = 8;
export const FIM_DO_EXPEDIENTE = 18;
export const DIAS_DO_RITMO = 3;
const FERIADOS_FIXOS = new Set([
  "01-01",
  "04-21",
  "05-01",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "11-20",
  "12-25",
]);

/* ── Datas ("AAAA-MM-DD") ───────────────────────────────────────────── */

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

const emMs = (dia: string) => Date.parse(`${dia}T00:00:00Z`);
const deMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const somarDias = (dia: string, n: number) =>
  deMs(emMs(dia) + n * DIA_MS);

export function ehDiaUtil(dia: string): boolean {
  const semana = new Date(emMs(dia)).getUTCDay();
  return semana !== 0 && semana !== 6 && !FERIADOS_FIXOS.has(dia.slice(5));
}

/** Hoje ainda conta como dia de trabalho? */
export const hojeConta = ({ hoje, hora }: Agora) =>
  ehDiaUtil(hoje) && hora < FIM_DO_EXPEDIENTE;

/** Dias úteis de hoje (se ainda conta) até o prazo, inclusive. */
export function diasUteisAtePrazo(agora: Agora, prazo: string): number {
  let dia = hojeConta(agora) ? agora.hoje : somarDias(agora.hoje, 1);
  let total = 0;
  while (dia <= prazo) {
    if (ehDiaUtil(dia)) total += 1;
    dia = somarDias(dia, 1);
  }
  return total;
}

/** O n-ésimo dia útil depois de `dia` (n ≥ 1). */
export function diaUtilDepois(dia: string, n: number): string {
  let atual = dia;
  let faltam = n;
  while (faltam > 0) {
    atual = somarDias(atual, 1);
    if (ehDiaUtil(atual)) faltam -= 1;
  }
  return atual;
}

/** Dias úteis em (de, ate] — o atraso de `ate` sobre `de`. */
function diasUteisEntre(de: string, ate: string): number {
  let total = 0;
  for (let dia = somarDias(de, 1); dia <= ate; dia = somarDias(dia, 1))
    if (ehDiaUtil(dia)) total += 1;
  return total;
}

/** Hoje e a hora em Brasília. */
export function agoraEmBrasilia(data: Date = new Date()): Agora {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(data)
      .map((p) => [p.type, p.value]),
  );
  return {
    hoje: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
  };
}

export const diaMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/* ── Etapa do cronograma ────────────────────────────────────────────── */

const semAcento = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const NOME_DA_ANALISE =
  /(valida|verifica)\w* d[aeo]s? (documenta|inscri)|(analise|avaliacao) (documental|curricula|de titulos|dos documentos)|validacao d[ao]s? documentos/;
const NAO_E_A_ANALISE =
  /resultado|divulga|publica|recurso|espelho|convoca|prazo|solicita|isencao/;
const TIPO_DA_ANALISE = /analise|avaliacao|documental|curricular/;

export function ehEtapaDaAnalise(etapa: EtapaDoCronograma): boolean {
  const nome = semAcento(etapa.atividade);
  return NOME_DA_ANALISE.test(nome) && !NAO_E_A_ANALISE.test(nome);
}

export function etapaDaAnalise(
  cronograma: readonly EtapaDoCronograma[],
  hoje: string,
): EtapaDoCronograma | null {
  const comFim = [...cronograma]
    .filter((e) => e.fim && DATA.test(e.fim))
    .sort((a, b) => a.ordem - b.ordem);
  const porTipo = comFim.filter(
    (e) => e.tipo && TIPO_DA_ANALISE.test(semAcento(e.tipo)),
  );
  const candidatas = porTipo.length ? porTipo : comFim.filter(ehEtapaDaAnalise);
  if (!candidatas.length) return null;
  return (
    candidatas.find((e) => (e.fim as string) >= hoje) ??
    candidatas[candidatas.length - 1]!
  );
}

/** O nome curto da etapa, para o card (o nome inteiro fica no title). */
export function nomeCurtoDaEtapa(atividade: string): string {
  const nome = semAcento(atividade);
  if (
    /(valida|verifica)\w* d[aeo]s? (documenta|inscri)|validacao d[ao]s? documentos/.test(
      nome,
    )
  )
    return "Validação da documentação";
  if (/(analise|avaliacao) curricula/.test(nome)) return "Análise curricular";
  if (/(analise|avaliacao) documental/.test(nome)) return "Análise documental";
  if (/(analise|avaliacao) de titulos/.test(nome)) return "Análise de títulos";
  const primeiro = atividade.split(/ \/ |, | por meio /)[0]!.trim();
  return primeiro.length > 40 ? `${primeiro.slice(0, 39)}…` : primeiro;
}

/* ── Leitura do retrato ─────────────────────────────────────────────── */

const inteiro = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};
const texto = (valor: unknown) =>
  typeof valor === "string" ? valor : valor == null ? "" : String(valor);
const objeto = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const lista = (valor: unknown): unknown[] =>
  Array.isArray(valor) ? valor : [];
const dataOuNulo = (valor: unknown) => {
  const t = texto(valor).slice(0, 10);
  return DATA.test(t) ? t : null;
};

/** O retrato da RPC (objeto ou `[objeto]`) em editais; malformado → []. */
export function lerRitmoDaAnalise(resposta: unknown): EditalDoRitmo[] {
  const raiz = objeto(Array.isArray(resposta) ? resposta[0] : resposta);
  return lista(raiz.editais)
    .map(objeto)
    .filter((e) => texto(e.id))
    .map((e) => {
      const s = objeto(e.situacoes);
      return {
        id: texto(e.id),
        edital: texto(e.edital) || "Edital",
        situacoes: {
          pendente: inteiro(s.pendente),
          em_analise: inteiro(s.em_analise),
          revisar: inteiro(s.revisar),
          concluida: inteiro(s.concluida),
          fora_lote: inteiro(s.fora_lote),
        },
        porDia: lista(e.por_dia)
          .map(objeto)
          .map((d) => ({ dia: dataOuNulo(d.dia), qt: inteiro(d.qt) }))
          .filter((d): d is { dia: string; qt: number } => Boolean(d.dia)),
        qtEquipe: inteiro(e.qt_equipe),
        qtAvaliadoresRecentes: inteiro(e.qt_avaliadores_recentes),
        cronograma: lista(e.cronograma)
          .map(objeto)
          .map((c) => ({
            ordem: inteiro(c.ordem),
            atividade: texto(c.atividade).trim(),
            tipo: texto(c.tipo).trim() || null,
            inicio: dataOuNulo(c.inicio),
            fim: dataOuNulo(c.fim),
          }))
          .filter((c) => c.atividade),
        destaques: lerDestaques(e.destaques),
      };
    });
}

function lerDestaques(valor: unknown): DestaquesDoRetrato | null {
  const d = objeto(valor);
  const dia = dataOuNulo(d.dia);
  if (!dia) return null;
  return {
    dia,
    avaliadores: lista(d.avaliadores)
      .map(objeto)
      .map((a) => ({
        nome: texto(a.nome).trim(),
        qt: inteiro(a.qt),
        reabertas: inteiro(a.reabertas),
      }))
      .filter((a) => a.nome && a.qt > 0),
  };
}

/* ── Destaques de hoje ──────────────────────────────────────────────── */

/** O mínimo de fichas no dia para o selo "Precisão" (o banco corta pelo mesmo). */
export const MINIMO_DO_SELO = 10;
export const MEDALHAS = ["🥇", "🥈", "🥉"] as const;
export const ROTULO_DA_MEDALHA = ["Ouro", "Prata", "Bronze"] as const;
export const SELO_DE_PRECISAO = "🎯";
const SEM_DESTAQUES: DestaquesDeHoje = Object.freeze({
  medalhas: [],
  precisao: [],
});

const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR");

/**
 * Medalhas (as três maiores contagens; empate, a mesma) e selos "Precisão"
 * (≥ `MINIMO_DO_SELO` concluídas e nenhuma reaberta) do retrato, se ele é
 * de hoje; de outro dia, nada (zera a cada dia).
 */
export function destaquesDoDia(
  retrato: DestaquesDoRetrato | null | undefined,
  hoje: string,
): DestaquesDeHoje {
  if (!retrato || retrato.dia !== hoje) return SEM_DESTAQUES;
  const avaliadores = retrato.avaliadores.filter((a) => a.nome && a.qt > 0);
  const podio = [...new Set(avaliadores.map((a) => a.qt))]
    .sort((a, b) => b - a)
    .slice(0, MEDALHAS.length);
  const medalhas = avaliadores
    .filter((a) => podio.includes(a.qt))
    .map((a) => ({
      nome: a.nome,
      qt: a.qt,
      posicao: (podio.indexOf(a.qt) + 1) as 1 | 2 | 3,
    }))
    .sort((a, b) => a.posicao - b.posicao || porNome(a.nome, b.nome));
  const precisao = avaliadores
    .filter((a) => a.qt >= MINIMO_DO_SELO && a.reabertas === 0)
    .map((a) => a.nome)
    .sort(porNome);
  return medalhas.length || precisao.length
    ? { medalhas, precisao }
    : SEM_DESTAQUES;
}

/* ── A conta ────────────────────────────────────────────────────────── */

/*
  O DIA (o bloco "Hoje", que oscila ao longo do expediente)
    Meta = (faltam + feito hoje) ÷ dias úteis de hoje até o prazo, contando
    hoje: é o que faltava às 00:00 dividido pelos dias que sobram, e não muda
    a cada ficha concluída. Prazo vencido: tudo hoje. Sem prazo: sem meta.
    Esperado agora = meta × fração do expediente (08:00–18:00) decorrida:
    antes das 8h, 0; depois das 18h, a meta inteira. Feito ≥ meta: meta
    batida (com o excedente); feito ≥ esperado: no ritmo; senão, abaixo.
    Sábado, domingo e feriado: não é dia útil.
*/

/** Quanto do expediente de hoje já passou (0 a 1). */
export function fracaoDoExpediente({ hora, minuto = 0 }: Agora): number {
  const agora = hora + minuto / 60;
  const total = FIM_DO_EXPEDIENTE - INICIO_DO_EXPEDIENTE;
  return Math.min(1, Math.max(0, (agora - INICIO_DO_EXPEDIENTE) / total));
}

/** Dias úteis de hoje (sempre, se útil) até o prazo, inclusive; ao menos 1. */
function diasUteisContandoHoje(hoje: string, prazo: string): number {
  let total = 0;
  for (let dia = hoje; dia <= prazo; dia = somarDias(dia, 1))
    if (ehDiaUtil(dia)) total += 1;
  return Math.max(1, total);
}

export function ritmoDoDia(
  {
    faltam,
    feito,
    prazo,
    avaliadores,
  }: {
    faltam: number;
    feito: number;
    prazo: string | null;
    avaliadores: number;
  },
  agora: Agora,
): RitmoDoDia {
  const vazio = {
    meta: 0,
    faltam: 0,
    porAvaliador: null,
    esperado: 0,
    excedente: 0,
  };
  if (!ehDiaUtil(agora.hoje)) return { ...vazio, situacao: "nao-util", feito };
  if (!prazo) return { ...vazio, situacao: "sem-meta", feito };
  const meta = Math.ceil(
    (faltam + feito) / diasUteisContandoHoje(agora.hoje, prazo),
  );
  const faltamHoje = Math.max(0, meta - feito);
  const esperado = Math.round(meta * fracaoDoExpediente(agora));
  const situacao: SituacaoDoDia =
    feito >= meta ? "batida" : feito >= esperado ? "no-ritmo" : "abaixo";
  return {
    situacao,
    meta,
    feito,
    faltam: faltamHoje,
    porAvaliador:
      faltamHoje && avaliadores ? Math.ceil(faltamHoje / avaliadores) : null,
    esperado,
    excedente: Math.max(0, feito - meta),
  };
}

export function calcularRitmo(
  edital: EditalDoRitmo,
  agora: Agora,
): RitmoDoEdital {
  const { situacoes: s } = edital;
  const faltam = s.pendente + s.em_analise + s.revisar;
  const concluidas = s.concluida;
  const total = faltam + concluidas;
  const percentual = total
    ? faltam
      ? Math.min(99, Math.floor((concluidas / total) * 100))
      : 100
    : 0;

  const etapa = etapaDaAnalise(edital.cronograma, agora.hoje);
  const prazo = etapa?.fim ?? null;
  const diasRestantes = prazo ? diasUteisAtePrazo(agora, prazo) : 0;
  const vencido = Boolean(prazo && prazo < agora.hoje);
  /* Prazo hoje depois do expediente (ou num fim de semana): tudo no próximo dia. */
  const porDia =
    prazo && faltam && !vencido
      ? Math.ceil(faltam / Math.max(1, diasRestantes))
      : null;

  const avaliadoresDaEquipe = edital.qtEquipe > 0;
  const avaliadores = avaliadoresDaEquipe
    ? edital.qtEquipe
    : edital.qtAvaliadoresRecentes;
  const porAvaliador =
    porDia !== null && avaliadores ? Math.ceil(porDia / avaliadores) : null;

  const contaHoje = hojeConta(agora);
  const concluidasHoje =
    edital.porDia.find((d) => d.dia === agora.hoje)?.qt ?? 0;
  const dias = edital.porDia
    .filter(
      (d) =>
        d.qt > 0 &&
        (d.dia < agora.hoje || (d.dia === agora.hoje && !contaHoje)),
    )
    .sort((a, b) => (a.dia < b.dia ? 1 : -1))
    .slice(0, DIAS_DO_RITMO);
  const ritmo = dias.length
    ? Math.round(dias.reduce((soma, d) => soma + d.qt, 0) / dias.length)
    : null;

  let termino: string | null = null;
  if (!faltam) termino = null;
  else if (ritmo) {
    const rendeHoje = contaHoje ? Math.max(0, ritmo - concluidasHoje) : 0;
    const resto = faltam - rendeHoje;
    termino =
      resto <= 0
        ? agora.hoje
        : diaUtilDepois(agora.hoje, Math.ceil(resto / ritmo));
  }
  const diasDeAtraso =
    termino && prazo && termino > prazo ? diasUteisEntre(prazo, termino) : 0;

  let situacao: SituacaoDoRitmo;
  if (!faltam) situacao = "concluido";
  else if (!prazo) situacao = "sem-prazo";
  else if (vencido) situacao = "vencido";
  else if (!termino) situacao = "sem-historico";
  else situacao = termino <= prazo ? "no-ritmo" : "abaixo";

  return {
    id: edital.id,
    edital: edital.edital,
    etapa:
      etapa && prazo
        ? {
            nome: nomeCurtoDaEtapa(etapa.atividade),
            atividade: etapa.atividade,
            fim: prazo,
          }
        : null,
    concluidas,
    faltam,
    percentual,
    diasRestantes,
    porDia,
    avaliadores,
    avaliadoresDaEquipe,
    porAvaliador,
    ritmo,
    diasDoRitmo: dias.length,
    concluidasHoje,
    termino,
    diasDeAtraso,
    situacao,
    dia: ritmoDoDia(
      { faltam, feito: concluidasHoje, prazo, avaliadores },
      agora,
    ),
    destaques: destaquesDoDia(edital.destaques, agora.hoje),
  };
}

/** Os editais do card, já calculados (ver "Que editais aparecem"). */
export function ritmosDaArea(
  editais: readonly EditalDoRitmo[],
  agora: Agora,
): RitmoDoEdital[] {
  return editais
    .map((edital) => calcularRitmo(edital, agora))
    .filter((r) => r.concluidas > 0 || r.situacao !== "vencido");
}

/* ── Textos ─────────────────────────────────────────────────────────── */

const numero = (n: number) => n.toLocaleString("pt-BR");
const EXTENSO = ["", "um", "dois", "três", "quatro", "cinco"];
const diasUteis = (n: number) =>
  `${EXTENSO[n] ?? numero(n)} ${n === 1 ? "dia útil" : "dias úteis"}`;

export const ROTULO_DA_SITUACAO: Record<SituacaoDoRitmo, string> = {
  concluido: "Concluído",
  "no-ritmo": "No ritmo",
  abaixo: "Abaixo do ritmo",
  vencido: "Prazo vencido",
  "sem-prazo": "",
  "sem-historico": "",
};

export const ROTULO_DO_DIA: Record<SituacaoDoDia, string> = {
  "nao-util": "Hoje não é dia útil",
  "sem-meta": "",
  batida: "Meta de hoje batida ✓",
  "no-ritmo": "No ritmo hoje",
  abaixo: "Abaixo do ritmo hoje",
};

/** O selo principal do card: o do dia (com o edital todo concluído, "Concluído"). */
export function seloDoCard(r: RitmoDoEdital): {
  rotulo: string;
  situacao: SituacaoDoDia | "concluido";
} {
  if (r.situacao === "concluido")
    return { rotulo: ROTULO_DA_SITUACAO.concluido, situacao: "concluido" };
  return { rotulo: ROTULO_DO_DIA[r.dia.situacao], situacao: r.dia.situacao };
}

/** "≈7 por avaliador até o fim do expediente (9 avaliadores) · …", ou o resumo do dia. */
export function textoDoDia(r: RitmoDoEdital): string {
  const d = r.dia;
  if (d.situacao === "nao-util") return "Hoje não é dia útil: sem meta.";
  if (d.situacao === "sem-meta")
    return "Sem prazo no cronograma: sem meta do dia.";
  if (d.situacao === "batida")
    return d.excedente
      ? `Meta batida, com ${numero(d.excedente)} além dela.`
      : "Meta batida.";
  const avaliadores = `${r.avaliadores} ${r.avaliadores === 1 ? "avaliador" : "avaliadores"}`;
  const porAvaliador =
    d.porAvaliador === null
      ? ""
      : `≈${numero(d.porAvaliador)} por avaliador até o fim do expediente (${avaliadores}) · `;
  return `${porAvaliador}esperado até agora: ${numero(d.esperado)}`;
}

/** "Média dos últimos dias ≈266/dia · termina por volta de 23/10, …" (a tendência). */
export function textoDeReferencia(r: RitmoDoEdital): string {
  if (r.situacao === "concluido") return "Todas as fichas do lote concluídas.";
  if (r.ritmo === null || !r.termino)
    return "Sem dias com análise para medir a média.";
  const inicio = `Média dos últimos dias ≈${numero(r.ritmo)}/dia · termina por volta de ${diaMes(r.termino)}`;
  if (!r.etapa) return inicio;
  const prazo = diaMes(r.etapa.fim);
  if (r.situacao === "vencido") return `${inicio}; o prazo era ${prazo}`;
  if (r.diasDeAtraso)
    return `${inicio}, ${diasUteis(r.diasDeAtraso)} depois do prazo de ${prazo}`;
  if (r.termino === r.etapa.fim) return `${inicio}, no prazo`;
  return `${inicio}, antes do prazo de ${prazo}`;
}

/** "Prazo: 22/10 · Validação da documentação", ou o aviso de sem prazo. */
export function textoDoPrazo(r: RitmoDoEdital): string {
  if (!r.etapa) return "Sem etapa de análise no cronograma";
  return `Prazo: ${diaMes(r.etapa.fim)} · ${r.etapa.nome}`;
}

/** A frase da projeção; "" quando não há o que projetar. */
export function textoDoRitmo(r: RitmoDoEdital): string {
  if (r.situacao === "concluido") return "Todas as fichas do lote concluídas.";
  if (r.ritmo === null || !r.termino)
    return "Sem dias com análise para medir o ritmo.";
  const inicio = `No ritmo atual (≈${numero(r.ritmo)} por dia), termina por volta de ${diaMes(r.termino)}`;
  if (!r.etapa) return `${inicio}.`;
  const prazo = diaMes(r.etapa.fim);
  if (r.situacao === "vencido") return `${inicio}; o prazo era ${prazo}.`;
  if (r.diasDeAtraso)
    return `${inicio}, ${diasUteis(r.diasDeAtraso)} depois do prazo de ${prazo}.`;
  if (r.termino === r.etapa.fim) return `${inicio}, no prazo.`;
  return `${inicio}, antes do prazo de ${prazo}.`;
}

/* ── No momento do resumo do Painel ─────────────────────────────────── */

type LinhaDoResumo = Record<string, unknown>;

const STATUS_QUE_FALTAM = {
  Pendente: "pendente",
  "Em análise": "em_analise",
  Revisar: "revisar",
} as const;
const STATUS_CONCLUIDOS = new Set(["Aprovado", "Reprovado"]);

/** "Edital 06/2026 (sanitarista)" → "6/2026" (como FC_NUMERO_EDITAL); "" sem número. */
function numeroDoEdital(valor: unknown): string {
  const m = texto(valor).match(/(\d{1,4})\s*\/\s*(\d{4})/);
  return m ? `${Number(m[1])}/${m[2]}` : "";
}

/* "DD/MM/AAAA" ou "AAAA-MM-DD" (a data da análise no painel) → "AAAA-MM-DD". */
function diaDaAnalise(valor: unknown): string {
  const bruto = texto(valor).trim();
  const br = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = bruto.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso?.[1] ?? "";
}

/**
 * Os editais do card com as contagens do resumo do Painel (as linhas que a
 * tela recebeu), para "Faltam" e "Concluído" baterem com os KPIs do topo.
 * Edital sem linha no resumo sai.
 */
export function noMomentoDoResumo(
  editais: readonly EditalDoRitmo[],
  linhas: readonly LinhaDoResumo[] | null | undefined,
  hoje: string,
): EditalDoRitmo[] {
  const porNumero = new Map<
    string,
    { situacoes: SituacoesDasFichas; hoje: number }
  >();
  for (const linha of linhas || []) {
    // "Todos" traz também o Inativo e as análises desativadas: o ritmo é só do Ativo.
    const escopo = linha?.__escopo;
    if (escopo !== undefined && escopo !== "ativo") continue;
    const numero = numeroDoEdital(linha?.edital);
    if (!numero) continue;
    let conta = porNumero.get(numero);
    if (!conta) {
      conta = {
        situacoes: {
          pendente: 0,
          em_analise: 0,
          revisar: 0,
          concluida: 0,
          fora_lote: 0,
        },
        hoje: 0,
      };
      porNumero.set(numero, conta);
    }
    const status = texto(linha?.status_consolidado).trim();
    if (Object.hasOwn(STATUS_QUE_FALTAM, status))
      conta.situacoes[
        STATUS_QUE_FALTAM[status as keyof typeof STATUS_QUE_FALTAM]
      ] += 1;
    else if (STATUS_CONCLUIDOS.has(status)) {
      conta.situacoes.concluida += 1;
      if (diaDaAnalise(linha?.data_analise) === hoje) conta.hoje += 1;
    }
  }
  return editais.flatMap((edital) => {
    const conta = porNumero.get(numeroDoEdital(edital.edital));
    if (!conta) return [];
    return [
      {
        ...edital,
        situacoes: {
          ...conta.situacoes,
          fora_lote: edital.situacoes.fora_lote,
        },
        porDia: [
          ...edital.porDia.filter((d) => d.dia !== hoje),
          ...(conta.hoje ? [{ dia: hoje, qt: conta.hoje }] : []),
        ],
      },
    ];
  });
}

/** "Conferido às 09:32 · só o 114/2026" (o momento do resumo, o do topo). */
export function textoDoMomento(
  edital: string,
  conferidoEm: unknown,
  agora: Date = new Date(),
): string {
  const quando = quandoFoi(conferidoEm, agora);
  const so = `só o ${edital}`;
  return quando ? `Conferido ${quando} · ${so}` : `Só o ${edital}`;
}

/** A linha do card recolhido: "hoje 120 de 269" (sem meta do dia: "faltam 1.098"). */
export function textoRecolhido(r: RitmoDoEdital): string {
  if (!r.faltam) return "concluído";
  if (r.dia.situacao === "nao-util" || r.dia.situacao === "sem-meta")
    return `faltam ${numero(r.faltam)}`;
  return `hoje ${numero(r.dia.feito)} de ${numero(r.dia.meta)}`;
}

/* Recolhido ou aberto: escolha de cada pessoa, neste navegador. */
const CHAVE_DO_RECOLHIDO = "monitora.analises.ritmo-recolhido";
const chaveDoRecolhido = (usuario: string | null | undefined) =>
  `${CHAVE_DO_RECOLHIDO}:${usuario || "anonimo"}`;

/** O card fica recolhido, a não ser que a pessoa o tenha aberto (recolhido por padrão). */
export function lerRitmoRecolhido(usuario: string | null | undefined): boolean {
  try {
    return globalThis.localStorage?.getItem(chaveDoRecolhido(usuario)) !== "0";
  } catch {
    return true;
  }
}

export function gravarRitmoRecolhido(
  usuario: string | null | undefined,
  recolhido: boolean,
): void {
  try {
    globalThis.localStorage?.setItem(
      chaveDoRecolhido(usuario),
      recolhido ? "1" : "0",
    );
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/* ── Comemoração da meta do dia (uma vez por dia, por pessoa) ───────── */

const CHAVE_DA_META_COMEMORADA = "monitora.analises.meta-comemorada";
const chaveDaMeta = (usuario: string | null | undefined) =>
  `${CHAVE_DA_META_COMEMORADA}:${usuario || "anonimo"}`;

/** O dia (AAAA-MM-DD) da última comemoração da meta desta pessoa; "" se nunca. */
export function lerMetaComemorada(usuario: string | null | undefined): string {
  try {
    return globalThis.localStorage?.getItem(chaveDaMeta(usuario)) || "";
  } catch {
    return "";
  }
}

export function gravarMetaComemorada(
  usuario: string | null | undefined,
  dia: string,
): void {
  try {
    globalThis.localStorage?.setItem(chaveDaMeta(usuario), dia);
  } catch {
    /* sem armazenamento: pode repetir na próxima carga, sem prejuízo */
  }
}

/** O edital cuja meta de hoje a equipe bateu (o primeiro), ou null. */
export function metaDaEquipeBatida(
  ritmos: readonly RitmoDoEdital[],
): RitmoDoEdital | null {
  return (
    ritmos.find(
      (r) =>
        r.situacao !== "concluido" &&
        r.dia.situacao === "batida" &&
        r.dia.meta > 0,
    ) ?? null
  );
}

export const TEXTO_DA_META_BATIDA = "Meta de hoje batida pela equipe! 🎉";
