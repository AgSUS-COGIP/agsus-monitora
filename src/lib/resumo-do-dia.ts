import { classificarEtapa } from "./etapas-de-edital.ts";
import { TIPO_DEMANDA_INTERNA } from "./demandas-internas.ts";

/*
  Resumo do dia do responsável (migration 20261104130000): o que a RPC
  `obter_meu_resumo_do_dia` devolve, lido e preparado para o popup e o
  sininho do topo (src/modulos/resumo-do-dia/). Regras puras: saudação pela
  hora de Brasília, primeiro nome, cor do tipo (a mesma do Cronograma),
  "e mais N" por bloco e a chave do "visto hoje" no navegador.
*/

export type MarcoDoResumo = "inicio" | "fim" | "dia_unico";

export type ItemDoResumo = {
  tipo: "etapa" | "demanda";
  id: string;
  titulo: string;
  editalId: string;
  edital: string;
  unidade: string;
  area: string;
  dataInicio: string;
  dataFim: string;
  marco: MarcoDoResumo;
  data: string;
  podeConcluir: boolean;
  /** A cor do tipo no Cronograma (`data-cor`). */
  cor: string;
  rotuloDoTipo: string;
};

export type ResumoDoDia = {
  data: string;
  perfil: string;
  nome: string;
  responsavel: boolean;
  editais: string[];
  demandas: string[];
  mostrarAoEntrar: boolean;
  hoje: ItemDoResumo[];
  proximos: ItemDoResumo[];
  atrasadas: ItemDoResumo[];
};

export type BlocoDoResumo = "hoje" | "proximos" | "atrasadas";

export const BLOCOS_DO_RESUMO: readonly {
  id: BlocoDoResumo;
  titulo: string;
}[] = Object.freeze([
  { id: "hoje", titulo: "Hoje" },
  { id: "proximos", titulo: "Próximos 7 dias" },
  { id: "atrasadas", titulo: "Atrasadas" },
]);

/** Até cinco por bloco; o resto vira "e mais N". */
export const LIMITE_POR_BLOCO = 5;

const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const txt = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dia = (valor: unknown) => {
  const texto = txt(valor).slice(0, 10);
  return DATA.test(texto) ? texto : "";
};
const MARCOS: readonly string[] = ["inicio", "fim", "dia_unico"];
const textos = (valor: unknown) =>
  Array.isArray(valor) ? valor.map(txt).filter(Boolean) : [];

function lerItem(valor: unknown): ItemDoResumo | null {
  const bruto = registro(valor);
  const tipo = bruto.tipo === "demanda" ? "demanda" : "etapa";
  const id = txt(bruto.id);
  const titulo = txt(bruto.titulo);
  const data = dia(bruto.data);
  if (!id || !titulo || !data) return null;
  const doTipo =
    tipo === "demanda" ? TIPO_DEMANDA_INTERNA : classificarEtapa(titulo);
  const marco = txt(bruto.marco);
  return {
    tipo,
    id,
    titulo,
    editalId: txt(bruto.edital_id),
    edital: txt(bruto.edital),
    unidade: txt(bruto.unidade),
    area: txt(bruto.area),
    dataInicio: dia(bruto.data_inicio) || data,
    dataFim: dia(bruto.data_fim) || data,
    marco: (MARCOS.includes(marco) ? marco : "dia_unico") as MarcoDoResumo,
    data,
    podeConcluir: tipo === "demanda" && bruto.pode_concluir === true,
    cor: doTipo.cor,
    rotuloDoTipo: doTipo.rotulo,
  };
}

const itens = (valor: unknown) =>
  Array.isArray(valor)
    ? valor.map(lerItem).filter((item): item is ItemDoResumo => item !== null)
    : [];

/** A resposta da RPC; `null` se não for um resumo. */
export function lerResumoDoDia(resposta: unknown): ResumoDoDia | null {
  const bruto = registro(resposta);
  const data = dia(bruto.data);
  if (!data) return null;
  return {
    data,
    perfil: txt(bruto.perfil),
    nome: txt(bruto.nome),
    responsavel: bruto.responsavel === true,
    editais: textos(bruto.editais),
    demandas: textos(bruto.demandas),
    mostrarAoEntrar: bruto.mostrar_ao_entrar !== false,
    hoje: itens(bruto.hoje),
    proximos: itens(bruto.proximos),
    atrasadas: itens(bruto.atrasadas),
  };
}

export const totalDoResumo = (resumo: ResumoDoDia | null) =>
  resumo
    ? resumo.hoje.length + resumo.proximos.length + resumo.atrasadas.length
    : 0;

/** O resumo sem a demanda (concluída no popup). */
export function semDemanda(resumo: ResumoDoDia, id: string): ResumoDoDia {
  const fora = (lista: ItemDoResumo[]) =>
    lista.filter((item) => !(item.tipo === "demanda" && item.id === id));
  return {
    ...resumo,
    hoje: fora(resumo.hoje),
    proximos: fora(resumo.proximos),
    atrasadas: fora(resumo.atrasadas),
  };
}

export function recortarBloco(lista: readonly ItemDoResumo[]) {
  return {
    visiveis: lista.slice(0, LIMITE_POR_BLOCO),
    mais: Math.max(0, lista.length - LIMITE_POR_BLOCO),
  };
}

/** A hora (0–23) em Brasília. */
export function horaEmBrasilia(agora: Date) {
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hourCycle: "h23",
  }).format(agora);
  return Number(hora) % 24;
}

export function saudacao(agora: Date) {
  const hora = horaEmBrasilia(agora);
  if (hora < 12) return "Bom dia";
  return hora < 18 ? "Boa tarde" : "Boa noite";
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || "";

/** "Bom dia, Ana — seus editais hoje". */
export function tituloDoResumo(nome: string, agora: Date) {
  const primeiro = primeiroNome(nome);
  return `${saudacao(agora)}${primeiro ? `, ${primeiro}` : ""} — seus editais hoje`;
}

const curta = (chave: string) => {
  const [, mes, d] = chave.split("-");
  return `${d}/${mes}`;
};

/** "começa 12/11", "termina 12/11", "12/11" (dia único) ou "venceu 10/11". */
export function quandoDoItem(item: ItemDoResumo, bloco: BlocoDoResumo) {
  if (bloco === "atrasadas") return `venceu ${curta(item.dataFim)}`;
  if (item.marco === "inicio") return `começa ${curta(item.data)}`;
  if (item.marco === "fim") return `termina ${curta(item.data)}`;
  return curta(item.data);
}

/** "10/2026 · DSEI Manaus", ou "Demanda interna" sem edital. */
export const ondeDoItem = (item: ItemDoResumo) =>
  [item.edital, item.unidade].filter(Boolean).join(" · ") || item.rotuloDoTipo;

/** O "visto hoje" deste navegador, por pessoa e dia. */
export const chaveDoVisto = (perfil: string, data: string) =>
  `agsus:resumo-do-dia:visto:${perfil}:${data}`;
