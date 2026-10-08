import type {
  LinhaDaBusca,
  ResultadoDaBusca,
  AtalhoDaBusca,
  ParteDoRealce,
} from "../componentes/busca-global/tipos.ts";
import {
  identificacaoDoMonitoramento,
  normalizarLinhaDoMonitoramento,
} from "./linhas-do-monitoramento.ts";

/*
  Busca global (Ctrl+K / Cmd+K): a lógica pura do componente
  `src/componentes/busca-global/`. Procura nas linhas do monitoramento
  (TB_MONITORAMENTO_INDIGENA, todas as áreas), na ordem em que chegaram do
  banco, até 12 resultados.
*/

import { tomDoRisco } from "./editais-do-nucleo.js";

export const LIMITE_DE_RESULTADOS = 12;

/* Campos em que o termo é procurado, juntos num texto só (como antes). */
export const CAMPOS_DA_BUSCA = Object.freeze([
  "edital",
  "unidade",
  "etapa",
  "status",
  "uf",
  "risco",
  "ciclo",
  "responsavel",
  "observacoes",
]);

/*
  O componente avisa o legado por este evento em `document`, com
  `detail.id` da linha escolhida: o legado é dono dos filtros e da navegação.
*/
export const EVENTO_ESCOLHA_DA_BUSCA = "agsus:busca-global-escolhida";

const textoBruto = (valor: unknown) =>
  typeof valor === "string" ||
  typeof valor === "number" ||
  typeof valor === "boolean"
    ? String(valor)
    : "";
const texto = (valor: unknown) => textoBruto(valor).trim();
/* Sem diferenciar maiúsculas nem acentos: "saude" acha "Saúde". */
const semAcento = (valor: unknown) =>
  textoBruto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const minusculo = (valor: unknown) => semAcento(texto(valor));

export function textoDaBusca(linha: LinhaDaBusca) {
  return CAMPOS_DA_BUSCA.map((campo) => minusculo(linha?.[campo])).join(" ");
}

/** Termo vazio não lista nada; senão, as primeiras `limite` linhas que contêm o termo. */
export function buscarLinhas(
  linhas: unknown,
  termo: string,
  limite: number = LIMITE_DE_RESULTADOS,
): ResultadoDaBusca[] {
  const procurado = minusculo(termo);
  if (
    !procurado ||
    !Number.isFinite(limite) ||
    limite <= 0 ||
    !Array.isArray(linhas)
  )
    return [];
  const resultado: ResultadoDaBusca[] = [];
  for (const item of linhas) {
    const linha = normalizarLinhaDoMonitoramento(item);
    if (!linha) continue;
    const id = identificacaoDoMonitoramento(linha.id);
    if (id === undefined) continue;
    if (!textoDaBusca(linha).includes(procurado)) continue;
    resultado.push({ ...linha, id });
    if (resultado.length >= limite) break;
  }
  return resultado;
}

export function tituloDoResultado(linha: LinhaDaBusca) {
  return `${texto(linha?.edital) || "-"} — ${texto(linha?.unidade)}`;
}

export function subtituloDoResultado(linha: LinhaDaBusca) {
  const etapa = texto(linha?.etapa);
  return linha?.uf ? `${etapa} · ${linha.uf}` : etapa;
}

const ROTULO_DO_TOM: Readonly<Record<string, string>> = {
  red: "Alto",
  yellow: "Médio",
  green: "Baixo",
};

/** O selo de risco: tom (red, yellow, green) e texto (Alto, Médio, Baixo). */
export function seloDoRisco(risco: unknown) {
  const tom = tomDoRisco(risco);
  return { tom, texto: ROTULO_DO_TOM[tom] ?? "Baixo" };
}

/*
  Divide `valor` em pedaços, marcando as ocorrências do termo (sem
  diferenciar maiúsculas nem acentos). O componente desenha os marcados em `<mark>`.
*/
export function partesRealcadas(
  valor: unknown,
  termo: string,
): ParteDoRealce[] {
  const original = textoBruto(valor).normalize("NFC");
  const procurado = minusculo(termo);
  if (!original) return [];
  const comparavel = semAcento(original);
  // Letra que muda de tamanho (minúscula ou sem acento) desalinharia os índices.
  if (!procurado || comparavel.length !== original.length)
    return [{ texto: original, realce: false }];
  const partes = [];
  let inicio = 0;
  let achado = comparavel.indexOf(procurado);
  while (achado !== -1) {
    if (achado > inicio)
      partes.push({ texto: original.slice(inicio, achado), realce: false });
    const fim = achado + procurado.length;
    partes.push({ texto: original.slice(achado, fim), realce: true });
    inicio = fim;
    achado = comparavel.indexOf(procurado, inicio);
  }
  if (inicio < original.length)
    partes.push({ texto: original.slice(inicio), realce: false });
  return partes;
}

/*
  Setas: para baixo avança até o último; para cima volta até o primeiro.
  -1 é "nenhum escolhido" (ao abrir e a cada letra digitada).
*/
export function proximoIndice(atual: number, tecla: string, total: number) {
  if (total <= 0) return -1;
  if (tecla === "ArrowDown") return Math.min(atual + 1, total - 1);
  if (tecla === "ArrowUp") return Math.max(atual - 1, 0);
  return atual;
}

export function ehAtalhoDaBusca(evento: AtalhoDaBusca | null | undefined) {
  return Boolean(
    (evento?.ctrlKey || evento?.metaKey) &&
    String(evento?.key).toLowerCase() === "k",
  );
}
