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
*/

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

export interface EditalDoRitmo {
  id: string;
  edital: string;
  situacoes: SituacoesDasFichas;
  porDia: readonly { dia: string; qt: number }[];
  qtEquipe: number;
  qtAvaliadoresRecentes: number;
  cronograma: readonly EtapaDoCronograma[];
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
}

export interface Agora {
  hoje: string;
  hora: number;
}

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
      hourCycle: "h23",
    })
      .formatToParts(data)
      .map((p) => [p.type, p.value]),
  );
  return {
    hoje: `${partes.year}-${partes.month}-${partes.day}`,
    hora: Number(partes.hour),
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
      };
    });
}

/* ── A conta ────────────────────────────────────────────────────────── */

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
