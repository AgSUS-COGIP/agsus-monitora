/*
  "Pedir mais acesso" (gaveta Meus acessos, no menu da conta): quem já tem
  conta pede um módulo com um nível, outra área ou outro grupo, com
  justificativa. O pedido é o mesmo da entrada (registrar_solicitacao_acesso,
  migration 20261124210000) e a aprovação é a de Configurações › Acessos ›
  Pendentes. Sem DOM: o que se pode pedir, a validação (as regras do banco),
  os argumentos da RPC, a situação do último pedido e a frase de cada pedido
  (na gaveta e em Pendentes). O estado é de src/app/casca/pedido-de-mais-acesso.ts.
*/
import {
  RESOURCES,
  niveisDoRecurso,
  posicaoDoNivel,
  rotuloDoNivel,
} from "./permissoes-recursos.ts";
import { rotuloDaArea } from "./meus-acessos.ts";
import { diaEMes, erroDaJustificativa } from "./solicitacao-de-acesso.ts";
import { AREAS_DO_SISTEMA } from "../navegacao/menu-lateral.ts";
import type { NivelDeAcesso, PerfilDeAcesso } from "./tipos-dos-acessos.ts";

const txt = (valor: unknown): string => String(valor ?? "").trim();

export type TipoDoPedido = "MODULO" | "AREA" | "GRUPO";

export const TIPOS_DO_PEDIDO: readonly {
  valor: TipoDoPedido;
  rotulo: string;
}[] = Object.freeze([
  { valor: "MODULO", rotulo: "Módulo" },
  { valor: "AREA", rotulo: "Área" },
  { valor: "GRUPO", rotulo: "Grupo" },
]);

/** Um grupo que se pode pedir (listar_opcoes_da_solicitacao_acesso.grupos). */
export type GrupoParaPedir = Readonly<{
  codigo: string;
  nome: string;
  descricao?: string | null;
}>;

export type Opcao = Readonly<{ valor: string; rotulo: string }>;

const nivelDoPerfil = (perfil: PerfilDeAcesso | null, recurso: string) =>
  perfil?.permissoes?.[recurso] ?? "sem_acesso";

/** Os níveis acima do de hoje que o módulo aceita (as regras da matriz). */
export function niveisParaPedir(
  perfil: PerfilDeAcesso | null,
  recurso: string,
): Opcao[] {
  const atual = posicaoDoNivel(nivelDoPerfil(perfil, recurso));
  return niveisDoRecurso(recurso)
    .filter(([nivel]) => posicaoDoNivel(nivel) > atual)
    .map(([valor, rotulo]) => ({ valor, rotulo }));
}

/** Os módulos em que ainda há nível acima do de hoje. */
export function modulosParaPedir(perfil: PerfilDeAcesso | null): Opcao[] {
  return RESOURCES.filter(
    ([recurso]) => niveisParaPedir(perfil, recurso).length > 0,
  ).map(([valor, rotulo]) => ({ valor, rotulo }));
}

/** As áreas que a pessoa ainda não tem; com coordenação, nenhuma (a área vem dela). */
export function areasParaPedir(perfil: PerfilDeAcesso | null): Opcao[] {
  if (perfil?.coordenacao?.codigo) return [];
  const tem = new Set(perfil?.areas ?? []);
  return AREAS_DO_SISTEMA.filter((a) => !tem.has(a.id)).map((a) => ({
    valor: a.id,
    rotulo: a.rotulo,
  }));
}

/** Os grupos que se podem pedir, sem o de hoje. */
export function gruposParaPedir(
  perfil: PerfilDeAcesso | null,
  grupos: readonly GrupoParaPedir[],
): Opcao[] {
  const atual = perfil?.grupo?.codigo ?? perfil?.perfil ?? "";
  return grupos
    .filter((g) => g.codigo && g.codigo !== atual)
    .map((g) => ({ valor: g.codigo, rotulo: g.nome || g.codigo }));
}

/** Os tipos com algo a pedir (sem área para pedir, "Área" não aparece). */
export function tiposParaPedir(
  perfil: PerfilDeAcesso | null,
  grupos: readonly GrupoParaPedir[],
): { valor: TipoDoPedido; rotulo: string }[] {
  const tem: Record<TipoDoPedido, boolean> = {
    MODULO: modulosParaPedir(perfil).length > 0,
    AREA: areasParaPedir(perfil).length > 0,
    GRUPO: gruposParaPedir(perfil, grupos).length > 0,
  };
  return TIPOS_DO_PEDIDO.filter((t) => tem[t.valor]);
}

/** Quem pode pedir: perfil ativo que não é administrador global. */
export function podePedirMaisAcesso(perfil: PerfilDeAcesso | null): boolean {
  return Boolean(perfil && perfil.ativo !== false && !perfil.admin_global);
}

// ── Formulário ───────────────────────────────────────────────────────────────

export type CamposDoPedidoDeMaisAcesso = {
  tipo: TipoDoPedido;
  recurso: string;
  nivel: string;
  area: string;
  grupo: string;
  justificativa: string;
};

export type ErrosDoPedidoDeMaisAcesso = Partial<
  Record<keyof CamposDoPedidoDeMaisAcesso, string>
>;

export const PEDIDO_VAZIO: Readonly<CamposDoPedidoDeMaisAcesso> = Object.freeze(
  {
    tipo: "MODULO",
    recurso: "",
    nivel: "",
    area: "",
    grupo: "",
    justificativa: "",
  },
);

/** Trocar de módulo: o nível que não vale mais sai. */
export function camposComModulo(
  campos: CamposDoPedidoDeMaisAcesso,
  perfil: PerfilDeAcesso | null,
  recurso: string,
): CamposDoPedidoDeMaisAcesso {
  const niveis = niveisParaPedir(perfil, recurso);
  const nivel = niveis.some((n) => n.valor === campos.nivel)
    ? campos.nivel
    : niveis.length === 1
      ? niveis[0]!.valor
      : "";
  return { ...campos, recurso, nivel };
}

/** Erros por campo ({} = válido), com as regras do banco. */
export function validarPedidoDeMaisAcesso(
  campos: CamposDoPedidoDeMaisAcesso,
  perfil: PerfilDeAcesso | null,
  grupos: readonly GrupoParaPedir[] = [],
): ErrosDoPedidoDeMaisAcesso {
  const erros: ErrosDoPedidoDeMaisAcesso = {};
  if (campos.tipo === "MODULO") {
    if (!modulosParaPedir(perfil).some((m) => m.valor === campos.recurso))
      erros.recurso = "Escolha o módulo.";
    else if (
      !niveisParaPedir(perfil, campos.recurso).some(
        (n) => n.valor === campos.nivel,
      )
    )
      erros.nivel = "Escolha o nível.";
  } else if (campos.tipo === "AREA") {
    if (!areasParaPedir(perfil).some((a) => a.valor === campos.area))
      erros.area = "Escolha a área.";
  } else if (
    !gruposParaPedir(perfil, grupos).some((g) => g.valor === campos.grupo)
  )
    erros.grupo = "Escolha o grupo.";
  const justificativa = erroDaJustificativa(campos.justificativa);
  if (justificativa) erros.justificativa = justificativa;
  return erros;
}

/** Os argumentos de registrar_solicitacao_acesso para o pedido de mais acesso. */
export function argumentosDoPedidoDeMaisAcesso(
  campos: CamposDoPedidoDeMaisAcesso,
) {
  const { tipo } = campos;
  return {
    p_nome: "",
    p_justificativa: txt(campos.justificativa),
    p_tipo: tipo,
    p_recurso: tipo === "MODULO" ? campos.recurso : null,
    p_nivel: tipo === "MODULO" ? campos.nivel : null,
    p_area: tipo === "AREA" ? campos.area : null,
    p_grupo: tipo === "GRUPO" ? campos.grupo : null,
  };
}

// ── O pedido (o meu, na gaveta; os dos outros, em Pendentes) ───────────────────

/** O pedido de mais acesso como obter_minha_solicitacao_acesso / listar_solicitacoes_acesso devolvem. */
export type PedidoDeMaisAcesso = {
  id?: string;
  status?: string | null;
  tipo?: string | null;
  recurso?: string | null;
  nivel?: string | null;
  area?: string | null;
  area_nome?: string | null;
  grupo_solicitado?: string | null;
  grupo_solicitado_nome?: string | null;
  justificativa?: string | null;
  created_at?: string | null;
  avaliado_em?: string | null;
  observacao_admin?: string | null;
  /** Só em Pendentes: o que a pessoa tem hoje. */
  grupo_atual_nome?: string | null;
  nivel_atual?: string | null;
  areas_atuais?: readonly string[] | null;
};

export function ehPedidoDeMaisAcesso(
  pedido: { tipo?: string | null } | null | undefined,
): boolean {
  return ["MODULO", "AREA", "GRUPO"].includes(txt(pedido?.tipo));
}

const rotuloDoModulo = (recurso: unknown) =>
  RESOURCES.find(([id]) => id === recurso)?.[1] ?? txt(recurso);

/** "Cronograma: Editor", "Área Projetos" ou "Grupo Gestor" ("" se não for pedido de mais acesso). */
export function oQueFoiPedido(pedido: PedidoDeMaisAcesso | null): string {
  if (!pedido || !ehPedidoDeMaisAcesso(pedido)) return "";
  if (pedido.tipo === "MODULO")
    return `${rotuloDoModulo(pedido.recurso)}: ${rotuloDoNivel(txt(pedido.nivel), txt(pedido.recurso))}`;
  if (pedido.tipo === "AREA")
    return `Área ${txt(pedido.area_nome) || rotuloDaArea(pedido.area)}`;
  return `Grupo ${txt(pedido.grupo_solicitado_nome) || txt(pedido.grupo_solicitado)}`;
}

/** O que a pessoa tem hoje, ao lado do pedido em Pendentes ("" sem a informação). */
export function oQueTemHoje(pedido: PedidoDeMaisAcesso | null): string {
  if (!pedido || !ehPedidoDeMaisAcesso(pedido)) return "";
  if (pedido.tipo === "MODULO")
    return pedido.nivel_atual
      ? `hoje: ${rotuloDoNivel(pedido.nivel_atual as NivelDeAcesso, txt(pedido.recurso))}`
      : "";
  if (pedido.tipo === "AREA")
    return pedido.areas_atuais?.length
      ? `hoje: ${pedido.areas_atuais.map(rotuloDaArea).join(", ")}`
      : "hoje: nenhuma área";
  return pedido.grupo_atual_nome ? `hoje: ${pedido.grupo_atual_nome}` : "";
}

export type SituacaoDoPedido = Readonly<{
  /** O tom do selo (vocabulário do `Selo` de src/ui/). */
  tom: "pendente" | "aprovado" | "reprovado" | "neutro";
  rotulo: string;
  /** "Enviado em 24/11", "Aprovado em 25/11"… */
  quando: string;
  /** O motivo da recusa ("" nos outros). */
  motivo: string;
  pendente: boolean;
}>;

/** A situação do último pedido de mais acesso (null sem pedido, ou se não for de mais acesso). */
export function situacaoDoPedido(
  pedido: PedidoDeMaisAcesso | null,
): SituacaoDoPedido | null {
  if (!pedido || !ehPedidoDeMaisAcesso(pedido)) return null;
  const status = txt(pedido.status).toLowerCase();
  const enviado = diaEMes(pedido.created_at);
  const avaliado = diaEMes(pedido.avaliado_em);
  const em = (dia: string, verbo: string) => (dia ? `${verbo} em ${dia}` : "");
  if (status === "pendente")
    return Object.freeze({
      tom: "pendente",
      rotulo: "Aguardando aprovação",
      quando: em(enviado, "Enviado"),
      motivo: "",
      pendente: true,
    });
  if (status === "aprovado")
    return Object.freeze({
      tom: "aprovado",
      rotulo: "Aprovado",
      quando: em(avaliado, "Aprovado"),
      motivo: "",
      pendente: false,
    });
  if (status === "recusado")
    return Object.freeze({
      tom: "reprovado",
      rotulo: "Recusado",
      quando: em(avaliado, "Recusado"),
      motivo: txt(pedido.observacao_admin),
      pendente: false,
    });
  return Object.freeze({
    tom: "neutro",
    rotulo: "Cancelado",
    quando: "",
    motivo: "",
    pendente: false,
  });
}
