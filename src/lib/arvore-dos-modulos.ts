import type {
  ArvoreDosModulos,
  AbaDosModulos,
  AreaDosModulos,
  PainelDosModulos,
  HistoricoDosModulos,
  ManutencaoDoModulo,
} from "../modulos/modulos/tipos.ts";

function invalido(): never {
  throw new Error("Resposta de módulos e abas inválida. Tente novamente.");
}
function registro(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    return invalido();
  return valor as Record<string, unknown>;
}
function texto(valor: unknown): string | null {
  if (valor == null) return null;
  return typeof valor === "string" ? valor : invalido();
}
function identificador(valor: unknown): string {
  const id = texto(valor)?.trim();
  return id ? id : invalido();
}
function booleano(valor: unknown): boolean | undefined {
  if (valor == null) return undefined;
  return typeof valor === "boolean" ? valor : invalido();
}
function lista<T>(valor: unknown, ler: (item: unknown) => T): T[] {
  if (valor == null) return [];
  if (!Array.isArray(valor)) return invalido();
  return valor.map(ler);
}
function manutencao(dados: Record<string, unknown>): ManutencaoDoModulo {
  return {
    situacao: texto(dados.situacao),
    mensagem: texto(dados.mensagem),
    previsao: texto(dados.previsao),
  };
}
function aba(valor: unknown): AbaDosModulos {
  const dados = registro(valor);
  return {
    ...manutencao(dados),
    co_aba: identificador(dados.co_aba),
    no_aba: texto(dados.no_aba),
    ativo: booleano(dados.ativo),
    beta: booleano(dados.beta),
  };
}
function area(valor: unknown): AreaDosModulos {
  const dados = registro(valor);
  return {
    ...manutencao(dados),
    co_area: identificador(dados.co_area),
    no_area: texto(dados.no_area),
    ativo: booleano(dados.ativo),
    abas: lista(dados.abas, aba),
  };
}
function painel(valor: unknown): PainelDosModulos {
  const dados = registro(valor);
  return {
    id: identificador(dados.id),
    titulo: texto(dados.titulo),
    ativo: booleano(dados.ativo),
    em_manutencao: booleano(dados.em_manutencao),
  };
}
function historico(valor: unknown): HistoricoDosModulos {
  const dados = registro(valor);
  return {
    escopo: texto(dados.escopo),
    area: texto(dados.area),
    aba: texto(dados.aba),
    painel: texto(dados.painel),
    campo: texto(dados.campo),
    quando: texto(dados.quando),
    motivo: texto(dados.motivo),
    autor: texto(dados.autor),
    anterior: dados.anterior,
    novo: dados.novo,
  };
}

/** Valida apenas o contrato usado pela tela; campos extras da RPC não viram controles. */
export function normalizarArvoreDosModulos(valor: unknown): ArvoreDosModulos {
  const dados = registro(valor);
  const sistema = dados.sistema == null ? {} : registro(dados.sistema);
  return {
    sistema: {
      ...manutencao(sistema),
      comemoracoes: booleano(sistema.comemoracoes),
    },
    areas: lista(dados.areas, area),
    abas: lista(dados.abas, aba),
    paineis: lista(dados.paineis, painel),
    historico: lista(dados.historico, historico),
  };
}

/** A contagem ausente ou inválida usa o lote enviado, sem renderizar JSON como texto. */
export function normalizarResultadoDosModulos(
  valor: unknown,
  totalDoLote: number,
): number {
  const total =
    valor && typeof valor === "object" && "alteradas" in valor
      ? valor.alteradas
      : null;
  return typeof total === "number" && Number.isSafeInteger(total) && total >= 0
    ? total
    : totalDoLote;
}

export function codigoDoErroDosModulos(erro: unknown): string {
  return erro &&
    typeof erro === "object" &&
    "code" in erro &&
    typeof erro.code === "string"
    ? erro.code
    : "";
}
