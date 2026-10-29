import { hasResource } from "./permissoes-recursos.ts";
import type {
  ContaParaComparar,
  ModuloDeAcesso,
  OpcaoDePapel,
  PaginasPermitidas,
  PainelExterno,
  PapelDeAcesso,
  PerfilDeAcesso,
  PermissaoLegada,
} from "./tipos-dos-acessos.ts";

/* O perfil chega sem tipo (getProfile, RPC); a forma é a de obter_contexto_monitora. */
const comoPerfil = (profile: unknown) =>
  profile as PerfilDeAcesso | null | undefined;

const ROLE_ALIASES: Readonly<Partial<Record<string, PapelDeAcesso>>> =
  Object.freeze({
    usuario: "usuario",
    leitor: "usuario",
    edital_gestor: "edital_gestor",
    editor: "edital_gestor",
    contratador: "contratador",
    admin: "admin",
    master: "admin",
  });

const ROLE_LEVEL: Readonly<Record<PapelDeAcesso, number>> = Object.freeze({
  usuario: 0,
  edital_gestor: 1,
  contratador: 2,
  admin: 3,
});

export const ACCESS_ROLES: readonly OpcaoDePapel[] = Object.freeze([
  { value: "usuario", label: "Usuário" },
  { value: "edital_gestor", label: "Gestor" },
  { value: "contratador", label: "Contratador" },
  { value: "admin", label: "Administrador global" },
]);

export function normalizeRole(profile: unknown): PapelDeAcesso | "" {
  const perfil = comoPerfil(profile);
  if (!perfil || perfil.ativo === false) return "";
  const value = String(perfil.perfil ?? perfil.role ?? "")
    .trim()
    .toLowerCase();
  return ROLE_ALIASES[value] || "";
}

export function roleLabel(profile: unknown): string {
  const perfil = comoPerfil(profile);
  // O grupo de acesso de verdade (obter_contexto_monitora), quando veio.
  if (perfil?.grupo?.nome) return perfil.grupo.nome;
  const role = normalizeRole(profile);
  return ACCESS_ROLES.find((item) => item.value === role)?.label || "Usuário";
}

/**
 * Rótulo de exibição de um código de perfil, venha como vier ("edital_gestor",
 * "Edital_gestor", "Admin", "master"). O que não é código (nome de grupo) fica
 * como veio; vazio vira "Usuário".
 */
export function rotuloDoPerfil(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  const papel = ROLE_ALIASES[texto.toLowerCase()];
  if (papel) return ACCESS_ROLES.find((item) => item.value === papel)!.label;
  return texto || "Usuário";
}

export function isOwnAccessProfile(
  currentUser: ContaParaComparar | null | undefined,
  targetProfile: ContaParaComparar | null | undefined,
): boolean {
  if (!currentUser || !targetProfile) return false;

  const currentId = String(currentUser.id ?? "").trim();
  const targetUserId = String(
    targetProfile.user_id ?? targetProfile.userId ?? "",
  ).trim();
  if (currentId && targetUserId && currentId === targetUserId) return true;

  const currentEmail = String(currentUser.email ?? "")
    .trim()
    .toLowerCase();
  const targetEmail = String(targetProfile.email ?? "")
    .trim()
    .toLowerCase();
  return Boolean(currentEmail && targetEmail && currentEmail === targetEmail);
}

function hasLevel(profile: unknown, minimum: PapelDeAcesso): boolean {
  const role = normalizeRole(profile);
  return role !== "" && ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

export function canViewCore(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes) return hasResource(profile, "aprovados");
  return normalizeRole(profile) !== "";
}

export function canManageEditais(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return (
      hasResource(profile, "nucleo", 2) || hasResource(profile, "calendario", 2)
    );
  return hasLevel(profile, "edital_gestor");
}

export function canImportApprovedList(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "importacao", 2);
  return hasLevel(profile, "edital_gestor");
}

export function canReplaceApprovedList(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "importacao", 3);
  return hasLevel(profile, "admin");
}

export function canChangeCandidateStatus(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "aprovados", 2);
  return hasLevel(profile, "contratador");
}

/** Admin do módulo: o único que muda um status já definido (trava de 20260928180000). */
export function canUnlockCandidateStatus(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "aprovados", 3);
  return hasLevel(profile, "admin");
}

/** Anexar e remover documento do candidato: só o admin do módulo (20260928235000). */
export function canManageCandidateAttachments(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "aprovados", 3);
  return hasLevel(profile, "admin");
}

/* Aba Seleção (20261001090000_selecao.sql): só consulta (leitor). */
export function canViewSelecao(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes) return hasResource(profile, "selecao");
  return normalizeRole(profile) !== "";
}

/*
  Avaliação documental (20261006090000_avaliacao_documental_permissao_e_menu.sql):
  ver a Fila (leitor); Regra, Equipe e Triagem só para quem coordena
  o edital. Quem coordena cada edital o banco decide
  (gestor do edital ou coordenação na equipe, com Administrador). Sem a matriz
  (contexto antigo), não aparece: o banco ainda não tem o recurso.
*/
export function canViewAvaliacaoDocumental(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "avaliacao_documental");
  return false;
}

/*
  Aba Classificação (20261002150000_classificacao.sql): ver (leitor); salvar a
  regra do edital, gerar e publicar listas e registrar sorteio (editor).
*/
export function canViewClassificacao(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "classificacao");
  return normalizeRole(profile) !== "";
}

export function canEditClassificacao(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "classificacao", 2);
  return ["admin", "edital_gestor"].includes(normalizeRole(profile));
}

/*
  Entrevistas (20260929235000_entrevistas.sql): o Painel de entrevistas e
  Conduzir entrevistas usam o mesmo recurso; escrever (convocar, configurar,
  lançar notas, roteiros) exige Editor, conferido pelo banco.
*/
export function canViewEntrevistas(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "entrevistas");
  return normalizeRole(profile) !== "";
}

/* Aba Recursos: ver (leitor) e cadastrar/editar (editor). Por padrão, admin e gestor editam. */
export function canViewRecursos(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes) return hasResource(profile, "recursos");
  return normalizeRole(profile) !== "";
}

export function canEditRecursos(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "recursos", 2);
  return ["admin", "edital_gestor"].includes(normalizeRole(profile));
}

/*
  Analisar recursos (a operação: registrar, enviar ao parecer, decidir,
  responder, ajustar a pontuação): quem edita Recursos ou dá o parecer
  jurídico, e vê Recursos. Quem só acompanha (leitor) fica com o Painel de
  recursos. O banco confere cada ação (pode_editar, pode_decidir).
*/
export function canAnalisarRecursos(profile: unknown): boolean {
  if (!canViewRecursos(profile)) return false;
  if (comoPerfil(profile)?.permissoes)
    return (
      canEditRecursos(profile) || hasResource(profile, "recursos_parecer", 2)
    );
  return canEditRecursos(profile);
}

export function canManageSubJudice(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "aprovados", 2);
  return hasLevel(profile, "contratador");
}

/*
  Alterar nota ou modalidade de quem já está na lista por decisão judicial, e
  desfazer a alteração (20261001150000_sub_judice_alteracao.sql): só o admin
  do módulo. Incluir sub judice continua com o editor.
*/
export function canAlterarPorDecisaoJudicial(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "aprovados", 3);
  return hasLevel(profile, "admin");
}

export function canManageSettings(profile: unknown): boolean {
  if (comoPerfil(profile)?.permissoes)
    return hasResource(profile, "configuracoes", 2);
  return hasLevel(profile, "admin");
}

/**
 * Administrador global: o perfil de acesso de sistema com ST_ADMIN_GLOBAL.
 * O banco manda `admin_global` no contexto; sem ele (banco anterior), o papel.
 */
export function isAdminGlobal(profile: unknown): boolean {
  const perfil = comoPerfil(profile);
  if (!perfil || perfil.ativo === false) return false;
  if (typeof perfil.admin_global === "boolean") return perfil.admin_global;
  return hasLevel(profile, "admin");
}

/**
 * Corrige coordenadas dos mapas (Saúde Indígena e Projetos): admin global ou
 * Gestor (perfil edital_gestor ativo). Espelho de private."FC_PODE_EDITAR_COORDENADA"
 * (20261002200000); a escrita direta no cadastro do mapa segue só do admin global.
 */
/** "Pessoas online": admin global ou Gestor — em teste com os dois primeiro (05/10/2026). */
export function podeVerPessoasOnline(profile: unknown): boolean {
  return isAdminGlobal(profile) || normalizeRole(profile) === "edital_gestor";
}

export function podeEditarCoordenadas(profile: unknown): boolean {
  return isAdminGlobal(profile) || normalizeRole(profile) === "edital_gestor";
}

/** Gerencia acessos: admin global, ou coordenador (módulo "acessos" ≥ editor). */
export function canManageAccess(profile: unknown): boolean {
  if (isAdminGlobal(profile)) return true;
  // O coordenador gerencia só a própria coordenação; sem ela o banco recusa
  // (FC_GESTOR_DE_ACESSOS). Perfil antigo sem o campo segue a regra de antes.
  const perfil = comoPerfil(profile);
  if (perfil?.permissoes && "coordenacao" in perfil && !perfil.coordenacao)
    return false;
  return hasResource(profile, "acessos", 2);
}

/** Grupos, coordenações e áreas dos editais: só o admin global. */
export const canManageGroups = isAdminGlobal;
export const canManageCoordinations = isAdminGlobal;
export const canMoveEditalBetweenAreas = isAdminGlobal;

/** Página Configurações: quem edita configurações ou quem gerencia acessos. */
export function podeAbrirConfiguracoes(profile: unknown): boolean {
  return canManageSettings(profile) || canManageAccess(profile);
}

/**
 * Seção de Configurações liberada: "acessos" é de quem gerencia acessos;
 * "modulos" (Módulos e abas: ativar, desativar, manutenção), "cargas"
 * (Status das atualizações) e "automacao" (chaves da automação), só do admin global; as demais, de quem edita
 * configurações.
 */
export function secaoDeConfiguracaoPermitida(
  profile: unknown,
  secao: string,
): boolean {
  if (secao === "acessos") return canManageAccess(profile);
  if (secao === "modulos") return isAdminGlobal(profile);
  if (secao === "cargas") return isAdminGlobal(profile);
  if (secao === "automacao") return isAdminGlobal(profile);
  return canManageSettings(profile);
}

/**
 * Permissão por chave antiga do legado (ind, cores, calendario, paineis,
 * config, admin). Com matriz, lê os módulos; sem ela, o papel e as flags p_*.
 */
export function permissaoLegada(
  profile: PerfilDeAcesso | null | undefined,
  // Chave fora de PermissaoLegada cai nas flags p_* (como no legado).
  perm: PermissaoLegada | (string & {}),
): boolean {
  const perfil = comoPerfil(profile);
  if (!perfil) return false;
  if (perfil.permissoes) {
    if (perm === "admin") return canManageAccess(profile);
    const resource = {
      ind: "dashboard",
      analises: "analises",
      cores: "nucleo",
      calendario: "calendario",
      paineis: "paineis",
      config: "configuracoes",
    } satisfies Record<
      Exclude<PermissaoLegada, "admin">,
      ModuloDeAcesso
    > as Partial<Record<string, ModuloDeAcesso>>;
    // Chave desconhecida: hasResource recebe undefined, como no legado.
    return hasResource(
      profile,
      resource[perm] as string,
      perm === "config" ? 2 : 1,
    );
  }
  const role = normalizeRole(profile);
  if (role) {
    if (["ind", "analises", "cores", "paineis"].includes(perm))
      return canViewCore(profile);
    if (["config", "admin"].includes(perm)) return canManageSettings(profile);
  }
  // Flags p_* do contexto antigo (fora de PerfilDeAcesso).
  return (perfil as Record<string, unknown>)["p_" + perm] === true;
}

/** Páginas do sistema que o perfil abre (a barra, a navegação e o "Ver como" usam a mesma regra). */
export function paginasPermitidas(profile: unknown): PaginasPermitidas {
  const pode = (perm: PermissaoLegada) =>
    permissaoLegada(comoPerfil(profile), perm);
  return {
    dashboard: pode("ind"),
    nucleo: pode("cores"),
    calendario: comoPerfil(profile)?.permissoes
      ? pode("calendario")
      : pode("cores"),
    approved: canViewCore(profile),
    analises: pode("analises"),
    "avaliacao-documental": canViewAvaliacaoDocumental(profile),
    "pre-classificacao": canViewAvaliacaoDocumental(profile),
    entrevistas: canViewEntrevistas(profile),
    "conduzir-entrevistas": canViewEntrevistas(profile),
    classificacao: canViewClassificacao(profile),
    recursos: canViewRecursos(profile),
    "analisar-recursos": canAnalisarRecursos(profile),
    selecao: canViewSelecao(profile),
    config: podeAbrirConfiguracoes(profile),
  };
}

/** Painéis externos liberados, em ordem. Com matriz, só os de `liberados` (ids). */
export function paineisPermitidos<P extends PainelExterno>(
  profile: unknown,
  paineis: readonly P[] | null | undefined,
  liberados: Iterable<unknown> | null | undefined,
): P[] {
  if (!permissaoLegada(comoPerfil(profile), "paineis")) return [];
  const ids = new Set([...(liberados || [])].map(String));
  return (paineis || [])
    .filter(
      (painel) =>
        painel &&
        painel.ativo !== false &&
        (!comoPerfil(profile)?.permissoes || ids.has(String(painel.id))),
    )
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
}
