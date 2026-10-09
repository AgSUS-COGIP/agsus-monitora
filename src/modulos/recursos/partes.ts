import { formatNumberBR } from "../../lib/formatters.js";

/*
  Formatos comuns da gaveta de Recursos (detalhe, formulário, resposta, anexos
  e modelos): data e hora, e nota. A seção e o par rótulo/valor são de
  src/ui/ (Secao, Kv).
*/

export const dataHora = (valor: string | number | Date | null | undefined) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export const nota = (valor: string | number | null | undefined) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : formatNumberBR(Number(valor), { maximumFractionDigits: 2 });
