import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDateBR(value, fallback = "") {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, "dd/MM/yyyy", { locale: ptBR }) : fallback;
}

export function formatDateTimeBR(value, fallback = "") {
  const parsed = parseDateValue(value);
  return parsed
    ? format(parsed, "dd/MM/yyyy HH:mm", { locale: ptBR })
    : fallback;
}

export function formatNumberBR(value, options = {}) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-BR", options)
    : "0";
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const parsed = parseISO(String(value));
  if (isValid(parsed)) return parsed;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}
