/*
  Catálogo e configuração das comemorações, sem DOM.

  - CATALOGO_DE_MARCOS: os marcos que o MONITORA já comemora (onde nascem
    está em `onde`); cada um com as opções padrão, que reproduzem o
    comportamento de antes da configuração.
  - A configuração publicada fica em TB_CONFIGURACAO, chave
    `comemoracoes_marcos` (CHAVE_DAS_COMEMORACOES), publicada com motivo e
    histórico pela barra fixa de Configurações (mesma publicação das outras
    seções). Valor vazio = tudo no padrão; o JSON guarda só o que difere.
  - Marcos personalizados simples, avaliados com dados que o front já tem:
    "edital X chegou a N contratados" (linhas do monitoramento) e "a área
    passou de N análises concluídas no dia" (linhas da tela de Análises).
  - A preferência pessoal (neste navegador) de não ver comemorações.

  O liga/desliga geral continua em Módulos e abas › Sistema inteiro
  (`sistema.comemoracoes`, src/lib/comemoracao.js).
*/

import {
  analisePendente,
  gravarArmazenamento,
  lerArmazenamento,
} from "./comemoracao.js";
import { chaveDoDia } from "./analises-curriculares.js";
import {
  DURACAO_MAXIMA_MS,
  DURACAO_MINIMA_MS,
  EFEITOS,
  NIVEIS,
} from "./motor-de-efeitos.js";

export type Efeito =
  | "fogos"
  | "confete"
  | "serpentina"
  | "estrelas"
  | "coracoes"
  | "baloes"
  | "aya"
  | "combinado";
export type Intensidade = "suave" | "normal" | "festa";
export type Publico = "quem-fez" | "area-online";
export type TipoPersonalizado = "edital-contratados" | "analises-no-dia";

export interface OpcoesDoMarco {
  ligado: boolean;
  efeito: Efeito;
  intensidade: Intensidade;
  /** Segundos; `null` = a duração automática do efeito. */
  duracaoS: number | null;
  som: boolean;
  mensagem: string;
  publico: Publico;
}

/** O desenho do último estouro dos fogos (src/lib/fogos-formas.js). */
export type FormaDoMarco =
  "coracao" | "estrela" | "check" | { tipo: "numero"; texto: string } | null;

export interface MarcoDoCatalogo {
  id: string;
  rotulo: string;
  grupo: string;
  onde: string;
  /** A forma no céu (no Testar; o marco de verdade passa a dele). */
  forma: FormaDoMarco;
  padrao: OpcoesDoMarco;
}

export interface MarcoPersonalizado extends OpcoesDoMarco {
  id: string;
  nome: string;
  tipo: TipoPersonalizado;
  edital: string;
  meta: number;
}

export interface ConfiguracaoDasComemoracoes {
  marcos: Readonly<Record<string, OpcoesDoMarco>>;
  personalizados: readonly MarcoPersonalizado[];
}

export const CHAVE_DAS_COMEMORACOES = "comemoracoes_marcos";
export const CHAVE_DA_PREFERENCIA_PESSOAL =
  "agsus_monitora_comemoracoes_pessoais";
export const LIMITE_DE_PERSONALIZADOS = 20;
export const TAMANHO_DA_MENSAGEM = 160;
export const DURACAO_MINIMA_S = DURACAO_MINIMA_MS / 1000;
export const DURACAO_MAXIMA_S = DURACAO_MAXIMA_MS / 1000;
export const META_MAXIMA = 100000;

export const PUBLICOS: readonly (readonly [Publico, string])[] = Object.freeze([
  ["quem-fez", "Só quem fez"],
  ["area-online", "Toda a área online"],
] as const);
/*
  "Toda a área online" precisa de um canal em tempo real por área, que o
  MONITORA ainda não tem (a presença é por batida de 45 s): fica só "quem
  fez" até lá (README de src/modulos/configuracoes/).
*/
export const PUBLICOS_DISPONIVEIS: readonly Publico[] = Object.freeze([
  "quem-fez",
]);

export const TIPOS_PERSONALIZADOS: readonly (readonly [
  TipoPersonalizado,
  string,
])[] = Object.freeze([
  ["edital-contratados", "Edital chegou a N contratados"],
  ["analises-no-dia", "Área passou de N análises no dia"],
] as const);

const opcoes = (efeito: Efeito, intensidade: Intensidade): OpcoesDoMarco =>
  Object.freeze({
    ligado: true,
    efeito,
    intensidade,
    duracaoS: null,
    som: false,
    mensagem: "",
    publico: "quem-fez",
  });

export const CATALOGO_DE_MARCOS: readonly MarcoDoCatalogo[] = Object.freeze([
  {
    id: "edital-concluido",
    rotulo: "Edital 100% analisado",
    grupo: "Análises curriculares",
    onde: "src/modulos/analises/marcos.js",
    forma: "coracao",
    padrao: opcoes("fogos", "normal"),
  },
  {
    id: "fila-zerada",
    rotulo: "Fila de análises zerada",
    grupo: "Análises curriculares",
    onde: "src/modulos/analises/marcos.js",
    forma: "estrela",
    padrao: opcoes("fogos", "normal"),
  },
  {
    id: "vaga-pronta",
    rotulo: "Vaga pronta para o resultado final",
    grupo: "Entrevistas",
    onde: "src/modulos/entrevistas/marcos.js",
    forma: null,
    padrao: opcoes("fogos", "suave"),
  },
  {
    id: "marco-do-ano",
    rotulo: "Marco do ano da área (1.000, 2.500… análises)",
    grupo: "Visão geral",
    onde: "src/modulos/visao-geral/boas-vindas.tsx",
    forma: { tipo: "numero", texto: "1.000" },
    padrao: opcoes("fogos", "festa"),
  },
  {
    id: "acesso-liberado",
    rotulo: "Acesso liberado ou reativado",
    grupo: "Acesso",
    onde: "src/modules/comemoracao-do-acesso.js",
    forma: "check",
    padrao: opcoes("fogos", "normal"),
  },
  {
    id: "fim-do-tour",
    rotulo: "Tour da Aya concluído",
    grupo: "Aya",
    onde: "src/modulos/aya/aya.jsx",
    forma: null,
    padrao: opcoes("fogos", "normal"),
  },
  {
    id: "fim-da-trilha",
    rotulo: "Trilha da Aya concluída",
    grupo: "Aya",
    onde: "src/modulos/aya/aya.jsx",
    forma: "estrela",
    padrao: opcoes("fogos", "festa"),
  },
]);

export const IDS_DO_CATALOGO: readonly string[] = Object.freeze(
  CATALOGO_DE_MARCOS.map((m) => m.id),
);

const marcoDoCatalogo = (id: string) =>
  CATALOGO_DE_MARCOS.find((m) => m.id === id);

// ── Normalização ────────────────────────────────────────────────────────────

const texto = (valor: unknown) => String(valor ?? "").trim();
const objeto = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};

const ehEfeito = (valor: unknown): valor is Efeito =>
  (EFEITOS as readonly unknown[]).includes(valor);
const ehIntensidade = (valor: unknown): valor is Intensidade =>
  typeof valor === "string" && Object.hasOwn(NIVEIS, valor);
const ehPublico = (valor: unknown): valor is Publico =>
  PUBLICOS_DISPONIVEIS.includes(valor as Publico);
const ehTipo = (valor: unknown): valor is TipoPersonalizado =>
  TIPOS_PERSONALIZADOS.some(([tipo]) => tipo === valor);

/** Segundos entre 2 e 15 (meio segundo de passo); vazio ou inválido, null. */
export function normalizarDuracaoS(valor: unknown): number | null {
  if (valor === null || valor === undefined || texto(valor) === "") return null;
  const numero = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero) || numero <= 0) return null;
  const limitado = Math.min(
    DURACAO_MAXIMA_S,
    Math.max(DURACAO_MINIMA_S, numero),
  );
  return Math.round(limitado * 2) / 2;
}

/** As opções de um marco a partir do bruto, completando com o padrão. */
export function normalizarOpcoes(
  bruto: unknown,
  padrao: OpcoesDoMarco,
): OpcoesDoMarco {
  const o = objeto(bruto);
  return {
    ligado: typeof o.ligado === "boolean" ? o.ligado : padrao.ligado,
    efeito: ehEfeito(o.efeito) ? o.efeito : padrao.efeito,
    intensidade: ehIntensidade(o.intensidade)
      ? o.intensidade
      : padrao.intensidade,
    duracaoS:
      "duracaoS" in o ? normalizarDuracaoS(o.duracaoS) : padrao.duracaoS,
    som: typeof o.som === "boolean" ? o.som : padrao.som,
    mensagem:
      typeof o.mensagem === "string"
        ? texto(o.mensagem).slice(0, TAMANHO_DA_MENSAGEM)
        : padrao.mensagem,
    publico: ehPublico(o.publico) ? o.publico : padrao.publico,
  };
}

export const PADRAO_DO_PERSONALIZADO: OpcoesDoMarco = opcoes(
  "confete",
  "normal",
);

/** Inteiro de 1 a META_MAXIMA; senão 0 (inválido). */
export function normalizarMeta(valor: unknown): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= META_MAXIMA
    ? numero
    : 0;
}

function normalizarPersonalizado(
  bruto: unknown,
  indice: number,
): MarcoPersonalizado | null {
  const o = objeto(bruto);
  if (!ehTipo(o.tipo)) return null;
  const id = texto(o.id).replace(/[^a-z0-9-]/gi, "") || `pessoal-${indice + 1}`;
  return {
    ...normalizarOpcoes(o, PADRAO_DO_PERSONALIZADO),
    id: id.startsWith("pessoal-") ? id : `pessoal-${id}`,
    nome: texto(o.nome).slice(0, 80),
    tipo: o.tipo,
    edital: o.tipo === "edital-contratados" ? texto(o.edital).slice(0, 60) : "",
    meta: normalizarMeta(o.meta),
  };
}

/**
 * A configuração a partir do valor publicado (texto JSON, objeto ou vazio).
 * Nunca lança: JSON quebrado ou campos desconhecidos viram o padrão.
 */
export function normalizarConfiguracao(
  bruto: unknown,
): ConfiguracaoDasComemoracoes {
  let dados: unknown = bruto;
  if (typeof bruto === "string") {
    try {
      dados = texto(bruto) ? JSON.parse(bruto) : {};
    } catch {
      dados = {};
    }
  }
  const o = objeto(dados);
  const marcosBrutos = objeto(o.marcos);
  const marcos = Object.fromEntries(
    CATALOGO_DE_MARCOS.map((m) => [
      m.id,
      normalizarOpcoes(marcosBrutos[m.id], m.padrao),
    ]),
  );
  const vistos = new Set<string>();
  const personalizados = (
    Array.isArray(o.personalizados) ? o.personalizados : []
  )
    .slice(0, LIMITE_DE_PERSONALIZADOS)
    .map(normalizarPersonalizado)
    .filter((p): p is MarcoPersonalizado => {
      if (!p || vistos.has(p.id)) return false;
      vistos.add(p.id);
      return true;
    });
  return { marcos, personalizados };
}

const CAMPOS_DAS_OPCOES = [
  "ligado",
  "efeito",
  "intensidade",
  "duracaoS",
  "som",
  "mensagem",
  "publico",
] as const;

function diferencas(
  atual: OpcoesDoMarco,
  padrao: OpcoesDoMarco,
): Partial<OpcoesDoMarco> {
  const saida: Record<string, unknown> = {};
  for (const campo of CAMPOS_DAS_OPCOES)
    if (atual[campo] !== padrao[campo]) saida[campo] = atual[campo];
  return saida as Partial<OpcoesDoMarco>;
}

/**
 * O valor a publicar: só o que difere do padrão, em JSON compacto e estável
 * (mesma configuração = mesmo texto, para a revisão não acusar mudança à
 * toa). Tudo no padrão: texto vazio.
 */
export function serializarConfiguracao(
  config: ConfiguracaoDasComemoracoes,
): string {
  const marcos: Record<string, Partial<OpcoesDoMarco>> = {};
  for (const m of CATALOGO_DE_MARCOS) {
    const atual = config.marcos[m.id];
    if (!atual) continue;
    const dif = diferencas(atual, m.padrao);
    if (Object.keys(dif).length) marcos[m.id] = dif;
  }
  const personalizados = config.personalizados.map((p) => ({
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    ...(p.tipo === "edital-contratados" ? { edital: p.edital } : {}),
    meta: p.meta,
    ...diferencas(p, PADRAO_DO_PERSONALIZADO),
  }));
  if (!Object.keys(marcos).length && !personalizados.length) return "";
  return JSON.stringify({
    ...(Object.keys(marcos).length ? { marcos } : {}),
    ...(personalizados.length ? { personalizados } : {}),
  });
}

/** Erros que impedem publicar (mensagens curtas, uma por problema). */
export function errosDaConfiguracao(
  config: ConfiguracaoDasComemoracoes,
): string[] {
  const erros: string[] = [];
  config.personalizados.forEach((p, i) => {
    const nome = p.nome || `Marco personalizado ${i + 1}`;
    if (!p.nome) erros.push(`Dê um nome ao marco personalizado ${i + 1}.`);
    if (p.tipo === "edital-contratados" && !p.edital)
      erros.push(`${nome}: informe o número do edital.`);
    if (!p.meta)
      erros.push(
        `${nome}: a meta deve ser um número inteiro de 1 a ${META_MAXIMA.toLocaleString("pt-BR")}.`,
      );
  });
  return erros;
}

/** Um id novo para um marco personalizado, que não colide com os da lista. */
export function novoIdDePersonalizado(
  lista: readonly MarcoPersonalizado[],
): string {
  let n = lista.length + 1;
  const usados = new Set(lista.map((p) => p.id));
  while (usados.has(`pessoal-${n}`)) n += 1;
  return `pessoal-${n}`;
}

export function novoPersonalizado(
  lista: readonly MarcoPersonalizado[],
  tipo: TipoPersonalizado = "edital-contratados",
): MarcoPersonalizado {
  return {
    ...PADRAO_DO_PERSONALIZADO,
    id: novoIdDePersonalizado(lista),
    nome: "",
    tipo,
    edital: "",
    meta: tipo === "analises-no-dia" ? 50 : 10,
  };
}

/** As opções valendo para um marco (do catálogo ou personalizado), ou null. */
export function opcoesDoMarco(
  config: ConfiguracaoDasComemoracoes,
  id: string,
): OpcoesDoMarco | null {
  if (marcoDoCatalogo(id))
    return config.marcos[id] ?? marcoDoCatalogo(id)?.padrao ?? null;
  return config.personalizados.find((p) => p.id === id) ?? null;
}

export const duracaoMsDasOpcoes = (op: Pick<OpcoesDoMarco, "duracaoS">) =>
  op.duracaoS ? Math.round(op.duracaoS * 1000) : null;

// ── Registro da configuração publicada (o app carrega, o desenho lê) ────────

let publicada: ConfiguracaoDasComemoracoes = normalizarConfiguracao("");

/** O app leu TB_CONFIGURACAO (src/app/configuracao.js). */
export function definirConfiguracaoDasComemoracoes(bruto: unknown): void {
  publicada = normalizarConfiguracao(bruto);
}

export const configuracaoDasComemoracoes = (): ConfiguracaoDasComemoracoes =>
  publicada;

// ── Preferência pessoal (neste navegador) ───────────────────────────────────

/** Sem preferência guardada (ou sem armazenamento), ligadas. */
export const comemoracoesPessoaisLigadas = (armazenamento: unknown): boolean =>
  lerArmazenamento(armazenamento, CHAVE_DA_PREFERENCIA_PESSOAL) !== "0";

export const guardarPreferenciaPessoal = (
  armazenamento: unknown,
  ligadas: boolean,
): boolean =>
  gravarArmazenamento(
    armazenamento,
    CHAVE_DA_PREFERENCIA_PESSOAL,
    ligadas ? null : "0",
  );

/**
 * A decisão de uma comemoração de marco: se aparece e com que opções. O
 * teste (botão Testar, Palco de testes) passa por cima da configuração e da
 * preferência pessoal; o resto respeita as duas.
 */
export function decidirComemoracao({
  marco,
  config = publicada,
  pessoal = true,
  teste = false,
}: {
  marco: string;
  config?: ConfiguracaoDasComemoracoes;
  pessoal?: boolean;
  teste?: boolean;
}): { mostrar: boolean; opcoes: OpcoesDoMarco | null } {
  const op = opcoesDoMarco(config, marco);
  if (teste) return { mostrar: true, opcoes: op };
  if (!pessoal) return { mostrar: false, opcoes: op };
  return { mostrar: Boolean(op?.ligado), opcoes: op };
}

// ── Marcos personalizados: a avaliação com dados do front ───────────────────

const mesmoEdital = (a: unknown, b: unknown) =>
  texto(a).toLowerCase() === texto(b).toLowerCase();

/** Contratados de um edital somando as linhas do monitoramento. */
export function contratadosDoEdital(
  linhas: readonly unknown[],
  edital: string,
): number {
  let total = 0;
  for (const bruta of Array.isArray(linhas) ? linhas : []) {
    const linha = objeto(bruta);
    if (!mesmoEdital(linha.edital, edital)) continue;
    const n = Number(linha.contratados);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

/** Análises concluídas (não pendentes) com data de análise em `dia` (AAAA-MM-DD). */
export function analisesConcluidasNoDia(
  linhas: readonly unknown[],
  dia: string,
): number {
  let total = 0;
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    const l = objeto(linha);
    if (analisePendente(l)) continue;
    if (chaveDoDia(l.data_analise) === dia) total += 1;
  }
  return total;
}

/** O dia de hoje no fuso local, AAAA-MM-DD. */
export function hojeComoChave(agora: Date = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

export interface EstadoDosPersonalizados {
  dia: string;
  valores: Record<string, number>;
}

/** Os valores atuais dos personalizados de um `tipo`. */
export function estadoDosPersonalizados(
  personalizados: readonly MarcoPersonalizado[],
  tipo: TipoPersonalizado,
  { linhas, dia }: { linhas: readonly unknown[]; dia: string },
): EstadoDosPersonalizados {
  const valores: Record<string, number> = {};
  for (const p of personalizados) {
    if (p.tipo !== tipo || !p.meta) continue;
    valores[p.id] =
      tipo === "edital-contratados"
        ? p.edital
          ? contratadosDoEdital(linhas, p.edital)
          : 0
        : analisesConcluidasNoDia(linhas, dia);
  }
  return { dia, valores };
}

/**
 * Os personalizados que cruzaram a meta entre a leitura anterior e a
 * atual (transição vista, como os outros marcos). "No dia" recomeça a
 * cada dia: guardado de outro dia vale zero.
 */
export function personalizadosAlcancados(
  anterior: unknown,
  atual: EstadoDosPersonalizados,
  personalizados: readonly MarcoPersonalizado[],
): MarcoPersonalizado[] {
  const a = objeto(anterior);
  if (!Object.keys(a).length) return [];
  const valoresAntes = objeto(a.valores);
  const outroDia = texto(a.dia) !== atual.dia;
  return personalizados.filter((p) => {
    if (!p.ligado || !(p.id in atual.valores)) return false;
    const agora = atual.valores[p.id] ?? 0;
    const bruto = Number(valoresAntes[p.id]);
    // Personalizado criado depois da leitura anterior: sem transição vista.
    if (!(p.id in valoresAntes)) return false;
    const antes =
      p.tipo === "analises-no-dia" && outroDia
        ? 0
        : Number.isFinite(bruto)
          ? bruto
          : 0;
    return antes < p.meta && agora >= p.meta;
  });
}

/** A frase do personalizado: a mensagem escrita ou a padrão. */
export function mensagemDoPersonalizado(p: MarcoPersonalizado): string {
  if (p.mensagem) return p.mensagem;
  const meta = p.meta.toLocaleString("pt-BR");
  return p.tipo === "edital-contratados"
    ? `Edital ${p.edital} chegou a ${meta} contratados! 🎉`
    : `A equipe passou de ${meta} análises concluídas hoje! 🎉`;
}

/** O rótulo de um marco (catálogo ou personalizado) para as telas. */
export function rotuloDoMarco(
  config: ConfiguracaoDasComemoracoes,
  id: string,
): string {
  return (
    marcoDoCatalogo(id)?.rotulo ||
    config.personalizados.find((p) => p.id === id)?.nome ||
    id
  );
}

// ── Revisão da publicação ───────────────────────────────────────────────────

const ROTULOS_DOS_CAMPOS: Readonly<Record<string, string>> = Object.freeze({
  ligado: "Ligado",
  efeito: "Efeito",
  intensidade: "Intensidade",
  duracaoS: "Duração (s)",
  som: "Som",
  mensagem: "Mensagem",
  publico: "Quem vê",
  nome: "Nome",
  tipo: "Tipo",
  edital: "Edital",
  meta: "Meta",
});

const paraTexto = (valor: unknown) =>
  valor === null || valor === undefined
    ? ""
    : typeof valor === "boolean"
      ? String(valor)
      : String(valor);

/**
 * O que muda entre dois valores publicados, campo a campo, para a revisão
 * da publicação ("Comemorações · Fila de análises zerada", "Efeito",
 * "fogos" → "confete") em vez do JSON inteiro.
 */
export function alteracoesDasComemoracoes(
  antes: unknown,
  depois: unknown,
): { label: string; field: string; before: string; after: string }[] {
  const a = normalizarConfiguracao(antes);
  const d = normalizarConfiguracao(depois);
  const saida: {
    label: string;
    field: string;
    before: string;
    after: string;
  }[] = [];
  for (const m of CATALOGO_DE_MARCOS) {
    const x = a.marcos[m.id] ?? m.padrao;
    const y = d.marcos[m.id] ?? m.padrao;
    for (const campo of CAMPOS_DAS_OPCOES)
      if (x[campo] !== y[campo])
        saida.push({
          label: `Comemorações · ${m.rotulo}`,
          field: ROTULOS_DOS_CAMPOS[campo] ?? campo,
          before: paraTexto(x[campo]),
          after: paraTexto(y[campo]),
        });
  }
  const ids = new Set([
    ...a.personalizados.map((p) => p.id),
    ...d.personalizados.map((p) => p.id),
  ]);
  for (const id of ids) {
    const x = a.personalizados.find((p) => p.id === id);
    const y = d.personalizados.find((p) => p.id === id);
    const label = `Comemorações · ${y?.nome || x?.nome || "Marco personalizado"}`;
    if (!x || !y) {
      saida.push({
        label,
        field: "Marco personalizado",
        before: x ? "Existe" : "",
        after: y ? "Criado" : "Removido",
      });
      continue;
    }
    for (const campo of [
      "nome",
      "tipo",
      "edital",
      "meta",
      ...CAMPOS_DAS_OPCOES,
    ] as const)
      if (x[campo] !== y[campo])
        saida.push({
          label,
          field: ROTULOS_DOS_CAMPOS[campo] ?? campo,
          before: paraTexto(x[campo]),
          after: paraTexto(y[campo]),
        });
  }
  return saida;
}
