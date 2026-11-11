/*
  Mensagem de boas-vindas da Visão geral: saudação pelo primeiro nome e uma
  informação do dia tirada dos próprios editais — nada de frase genérica.

  Funções puras; o componente fica em `src/modulos/visao-geral/boas-vindas.tsx`.
*/

import { hojeEmBrasilia } from "./cronograma-do-edital.ts";

const texto = (valor: unknown): string => String(valor ?? "").trim();

/* "AAAA-MM-DD" + n dias, sem fuso (meio-dia UTC não vira o dia ao somar). */
function somarDias(iso: string, dias: number): string {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** "YASSURY SOUSA" → "Yassury"; "maria de fátima" → "Maria". */
export function primeiroNome(nome: unknown): string {
  const primeiro = texto(nome).split(/\s+/)[0] || "";
  if (!primeiro) return "";
  const minusculo = primeiro.toLocaleLowerCase("pt-BR");
  return minusculo.charAt(0).toLocaleUpperCase("pt-BR") + minusculo.slice(1);
}

/** Data local no formato AAAA-MM-DD (a do banco, sem fuso). */
export function chaveDoDia(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Editais cuja próxima etapa cai nos `dias` dias contando hoje (7: de hoje a
 * hoje + 6, decisão de 11/11/2026; antes contava 8), com o dia
 * de Brasília (como a tabela e o cronograma, não o relógio do computador) e
 * sem os editais cancelados (a etapa deles não vai acontecer).
 */
export function editaisComEtapaNaSemana(
  linhas: unknown,
  hoje: Date = new Date(),
  dias = 7,
): number {
  const inicio = hojeEmBrasilia(hoje);
  const fim = somarDias(inicio, dias - 1);
  return (
    (Array.isArray(linhas) ? linhas : []) as ({
      cronograma_proxima_data?: unknown;
      status?: unknown;
    } | null)[]
  ).filter((linha) => {
    if (/^cancelad/i.test(texto(linha?.status))) return false;
    const data = texto(linha?.cronograma_proxima_data).slice(0, 10);
    return data && data >= inicio && data <= fim;
  }).length;
}

export function resumoDoDia(quantidade: number): string {
  if (!quantidade) return "Nenhum edital com etapa nos próximos 7 dias.";
  if (quantidade === 1) return "1 edital tem etapa nos próximos 7 dias.";
  return `${quantidade.toLocaleString("pt-BR")} editais têm etapa nos próximos 7 dias.`;
}
