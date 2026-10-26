import { RESOURCES, niveisDoRecurso } from "./permissoes-recursos.ts";
import {
  mapaDeAreasDasUnidades,
  normalizarNomeDaUnidade,
  opcoesDeUnidade,
  unidadesDaArea,
} from "./editais-do-nucleo.ts";
import { normalizarResponsavel } from "./responsavel-do-edital.ts";
import type {
  CoordenacaoDeAcesso,
  CoordenacaoParaSalvar,
  ErrosDoFormulario,
  GrupoDeAcesso,
  GrupoParaSalvar,
  NivelDeAcesso,
  OpcaoDeSelecao,
  RascunhoDaCoordenacao,
  RascunhoDoGrupo,
} from "./tipos-dos-acessos.ts";

/** Grupo ou coordenação já cadastrado (para conferir nome e código). */
type Existente = { codigo: string; nome?: string | null };

/** Edital da área (linha do Núcleo) para a lista explícita da coordenação. */
type LinhaDeEdital = {
  id?: string | number | null;
  ativo?: boolean;
  edital?: string | null;
  unidade?: string | null;
};

/*
  Formulários de Configurações › Acessos: grupo (níveis por módulo)
  e coordenação (área, responsável, unidades, editais). Validação e payload;
  o banco confere de novo (salvar_grupo_acesso, salvar_coordenacao).
*/

const txt = (valor: unknown) => String(valor ?? "").trim();

/** Código a partir do nome: "Coordenação Norte" → "coordenacao-norte". */
export function codigoAPartirDoNome(nome: unknown, separador = "-"): string {
  return txt(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separador)
    .replace(new RegExp(`^\\${separador}+|\\${separador}+$`, "g"), "");
}

// ── Grupo ─────────────────────────────────────────────────────────────

export function grupoVazio(): RascunhoDoGrupo {
  return {
    codigo: "",
    nome: "",
    descricao: "",
    revisao: null,
    // Grupo novo nasce sem acesso a nada.
    niveis: Object.fromEntries(
      RESOURCES.map(([id]): [string, NivelDeAcesso] => [id, "sem_acesso"]),
    ),
  };
}

export function lerGrupo(
  grupo: GrupoDeAcesso | null | undefined,
): RascunhoDoGrupo {
  if (!grupo) return grupoVazio();
  return {
    codigo: grupo.codigo,
    nome: grupo.nome || "",
    descricao: grupo.descricao || "",
    revisao: grupo.revisao ?? null,
    sistema: Boolean(grupo.sistema),
    adminGlobal: Boolean(grupo.admin_global),
    niveis: {
      ...grupoVazio().niveis,
      ...(grupo.niveis || {}),
    },
  };
}

/** Erros por campo ({} = válido). */
export function validarGrupo(
  rascunho: RascunhoDoGrupo,
  { existentes = [] }: { existentes?: readonly Existente[] } = {},
): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};
  const codigo =
    rascunho.revisao === null
      ? codigoAPartirDoNome(rascunho.nome, "_")
      : rascunho.codigo;
  if (txt(rascunho.nome).length < 2) erros.nome = "Informe o nome do grupo.";
  else if (
    existentes.some(
      (p) =>
        p.codigo !== rascunho.codigo &&
        txt(p.nome).toLowerCase() === txt(rascunho.nome).toLowerCase(),
    )
  )
    erros.nome = "Já existe um grupo com esse nome.";
  else if (!/^[a-z]+(_[a-z]+)*$/.test(codigo))
    erros.nome = "Use letras no nome (o código sai dele).";
  else if (
    rascunho.revisao === null &&
    existentes.some((p) => p.codigo === codigo)
  )
    erros.nome = "Já existe um grupo com esse código.";
  for (const [recurso, nivel] of Object.entries(rascunho.niveis || {}))
    if (!niveisDoRecurso(recurso).some(([valor]) => valor === nivel))
      erros[recurso] = "Nível inválido.";
  return erros;
}

export function grupoParaSalvar(rascunho: RascunhoDoGrupo): GrupoParaSalvar {
  return {
    codigo:
      rascunho.revisao === null
        ? codigoAPartirDoNome(rascunho.nome, "_")
        : rascunho.codigo,
    nome: txt(rascunho.nome),
    descricao: txt(rascunho.descricao),
    revisao: rascunho.revisao,
    niveis: { ...rascunho.niveis },
  };
}

// ── Coordenação ─────────────────────────────────────────────────────────

export function coordenacaoVazia(area = ""): RascunhoDaCoordenacao {
  return {
    codigo: "",
    nome: "",
    area,
    responsavel: "",
    unidades: [],
    editais: [],
    ativo: true,
    revisao: null,
  };
}

export function lerCoordenacao(
  coordenacao: CoordenacaoDeAcesso | null | undefined,
): RascunhoDaCoordenacao {
  if (!coordenacao) return coordenacaoVazia();
  return {
    codigo: coordenacao.codigo,
    nome: coordenacao.nome || "",
    area: coordenacao.area || "",
    responsavel: coordenacao.responsavel || "",
    unidades: [...(coordenacao.unidades || [])],
    editais: [...(coordenacao.editais || [])].map(String),
    ativo: coordenacao.ativo !== false,
    revisao: coordenacao.revisao ?? null,
  };
}

export function validarCoordenacao(
  rascunho: RascunhoDaCoordenacao,
  { existentes = [] }: { existentes?: readonly Existente[] } = {},
): ErrosDoFormulario {
  const erros: ErrosDoFormulario = {};
  const codigo =
    rascunho.revisao === null
      ? codigoAPartirDoNome(rascunho.nome)
      : rascunho.codigo;
  if (txt(rascunho.nome).length < 2)
    erros.nome = "Informe o nome da coordenação.";
  else if (
    existentes.some(
      (c) =>
        c.codigo !== rascunho.codigo &&
        txt(c.nome).toLowerCase() === txt(rascunho.nome).toLowerCase(),
    )
  )
    erros.nome = "Já existe uma coordenação com esse nome.";
  else if (!codigo) erros.nome = "Use letras ou números no nome.";
  else if (
    rascunho.revisao === null &&
    existentes.some((c) => c.codigo === codigo)
  )
    erros.nome = "Já existe uma coordenação com esse código.";
  if (!txt(rascunho.area)) erros.area = "Escolha a área.";
  if (rascunho.responsavel && !normalizarResponsavel(rascunho.responsavel))
    erros.responsavel = "Responsável inválido.";
  return erros;
}

export function coordenacaoParaSalvar(
  rascunho: RascunhoDaCoordenacao,
): CoordenacaoParaSalvar {
  return {
    codigo:
      rascunho.revisao === null
        ? codigoAPartirDoNome(rascunho.nome)
        : rascunho.codigo,
    nome: txt(rascunho.nome),
    area: rascunho.area,
    responsavel: rascunho.responsavel || null,
    unidades: [...new Set(rascunho.unidades.map(txt).filter(Boolean))],
    editais: [...new Set(rascunho.editais.map(String))],
    ativo: rascunho.ativo !== false,
    revisao: rascunho.revisao,
  };
}

/** O que a coordenação recorta, em uma linha. */
export function resumoDaCoordenacao(
  coordenacao: Pick<
    CoordenacaoDeAcesso,
    "responsavel" | "unidades" | "editais"
  >,
): string {
  const partes: string[] = [];
  if (coordenacao.responsavel) partes.push(coordenacao.responsavel);
  const unidades = coordenacao.unidades?.length || 0;
  const editais = coordenacao.editais?.length || 0;
  if (unidades)
    partes.push(`${unidades} ${unidades === 1 ? "unidade" : "unidades"}`);
  if (editais)
    partes.push(`${editais} ${editais === 1 ? "edital" : "editais"}`);
  return partes.length ? partes.join(" · ") : "A área inteira";
}

/**
 * Unidades que a coordenação pode escolher: as da área e, com responsável,
 * só as desse responsável. A chave é o nome oficial (o CORES não tem id).
 */
export function opcoesDeUnidadesDaCoordenacao({
  area,
  responsavel,
  catalogo = [],
  linhas = [],
  unidadesPorArea = [],
}: {
  area: string;
  responsavel?: string | null;
  catalogo?: object[];
  linhas?: object[];
  unidadesPorArea?: { unidade: string; area: string }[];
}): OpcaoDeSelecao[] {
  const mapa = mapaDeAreasDasUnidades({ unidadesPorArea, catalogo, linhas });
  const doResponsavel = responsavel
    ? opcoesDeUnidade(responsavel, catalogo, linhas)
    : [
        ...opcoesDeUnidade("USI", catalogo, linhas),
        ...opcoesDeUnidade("CORES", catalogo, linhas),
      ];
  const vistos = new Set<string>();
  return unidadesDaArea(doResponsavel, area, mapa)
    .filter((unidade: { nome_oficial: string }) => {
      const chave = normalizarNomeDaUnidade(unidade.nome_oficial);
      if (!chave || vistos.has(chave)) return false;
      vistos.add(chave);
      return mapa.get(chave) === area;
    })
    .map((unidade: { nome_oficial: string }) => ({
      value: unidade.nome_oficial,
      label: unidade.nome_oficial,
    }));
}

/** Editais da área que a coordenação pode receber pela lista explícita. */
export function opcoesDeEditaisDaCoordenacao(
  linhasDaArea: readonly (LinhaDeEdital | null | undefined)[] = [],
): OpcaoDeSelecao[] {
  return linhasDaArea
    .filter((linha) => linha?.id && linha.ativo !== false)
    .map((linha) => ({
      // O filtro acima garante a linha com id.
      value: String(linha!.id),
      label:
        [linha!.edital, linha!.unidade].map(txt).filter(Boolean).join(" · ") ||
        String(linha!.id),
    }));
}

/** Coordenações agrupadas por área, para <optgroup>. */
export function coordenacoesPorArea<
  C extends { area?: string | null },
  A extends { id: string },
>(
  coordenacoes: readonly C[] = [],
  areas: readonly A[] = [],
): { area: A; coordenacoes: C[] }[] {
  return areas
    .map((area) => ({
      area,
      coordenacoes: coordenacoes.filter((c) => c.area === area.id),
    }))
    .filter((grupo) => grupo.coordenacoes.length);
}

// ── Conta de setor → coordenação (ação perigosa) ─────────────────────────────

/*
  mover_conta_para_coordenacoes DESATIVA a conta e cria (ou reaproveita) a
  coordenação com o nome dela. Em 30/09 um administrador usou isso numa conta
  de PESSOA achando que era um ajuste e a conta perdeu o acesso. Por isso: só
  no "Avançado" da gaveta, nunca para a própria conta, e com confirmação
  escrita (CONFIRMAR ou o e-mail da conta) e motivo.
*/

export const PALAVRA_DE_CONFIRMACAO = "CONFIRMAR";

/** O nome que o banco dá à coordenação: o nome da conta ou o e-mail antes do @. */
type ContaDoSetor = { nome?: string | null; email?: string | null };

export function nomeDaCoordenacaoDaConta(
  conta: ContaDoSetor | null | undefined,
): string {
  return (
    txt(conta?.nome) ||
    txt(conta?.email).split("@")[0] ||
    "(sem nome)"
  ).slice(0, 120);
}

/** A frase que diz, com todas as letras, o que vai acontecer. */
export function avisoDeTransformarEmCoordenacao(
  conta: ContaDoSetor | null | undefined,
  tituloDaArea: unknown,
): string {
  const area = txt(tituloDaArea) || "escolhida";
  return `Isto vai DESATIVAR a conta ${txt(conta?.email)} (ela não entra mais) e criar a coordenação ${nomeDaCoordenacaoDaConta(conta)} na área ${area}. Use só para contas compartilhadas de setor.`;
}

/** A confirmação digitada vale? "CONFIRMAR" ou o e-mail da conta (sem caixa). */
export function confirmacaoDeTransformarValida(
  digitado: unknown,
  conta: ContaDoSetor | null | undefined,
): boolean {
  const valor = txt(digitado);
  if (!valor) return false;
  if (valor === PALAVRA_DE_CONFIRMACAO) return true;
  const email = txt(conta?.email).toLowerCase();
  return Boolean(email) && valor.toLowerCase() === email;
}
