import { hasResource } from "./permissoes-recursos.js";

const ROLE_ALIASES = Object.freeze({
  usuario: "usuario",
  leitor: "usuario",
  edital_gestor: "edital_gestor",
  editor: "edital_gestor",
  contratador: "contratador",
  admin: "admin",
  master: "admin",
});

const ROLE_LEVEL = Object.freeze({
  usuario: 0,
  edital_gestor: 1,
  contratador: 2,
  admin: 3,
});

export const ACCESS_ROLES = Object.freeze([
  { value: "usuario", label: "Usuário" },
  { value: "edital_gestor", label: "Edital gestor" },
  { value: "contratador", label: "Contratador" },
  { value: "admin", label: "Admin" },
]);

export function normalizeRole(profile) {
  if (!profile || profile.ativo === false) return "";
  const value = String(profile.perfil ?? profile.role ?? "")
    .trim()
    .toLowerCase();
  return ROLE_ALIASES[value] || "";
}

export function roleLabel(profile) {
  // O grupo de acesso de verdade (obter_contexto_monitora), quando veio.
  if (profile?.grupo?.nome) return profile.grupo.nome;
  const role = normalizeRole(profile);
  return ACCESS_ROLES.find((item) => item.value === role)?.label || "Usuário";
}

export function isOwnAccessProfile(currentUser, targetProfile) {
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

function hasLevel(profile, minimum) {
  const role = normalizeRole(profile);
  return role !== "" && ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

export function canViewCore(profile) {
  if (profile?.permissoes) return hasResource(profile, "aprovados");
  return normalizeRole(profile) !== "";
}

export function canManageEditais(profile) {
  if (profile?.permissoes)
    return (
      hasResource(profile, "nucleo", 2) || hasResource(profile, "calendario", 2)
    );
  return hasLevel(profile, "edital_gestor");
}

export function canImportApprovedList(profile) {
  if (profile?.permissoes) return hasResource(profile, "importacao", 2);
  return hasLevel(profile, "edital_gestor");
}

export function canReplaceApprovedList(profile) {
  if (profile?.permissoes) return hasResource(profile, "importacao", 3);
  return hasLevel(profile, "admin");
}

export function canChangeCandidateStatus(profile) {
  if (profile?.permissoes) return hasResource(profile, "aprovados", 2);
  return hasLevel(profile, "contratador");
}

/** Admin do módulo: o único que muda um status já definido (trava de 20260928180000). */
export function canUnlockCandidateStatus(profile) {
  if (profile?.permissoes) return hasResource(profile, "aprovados", 3);
  return hasLevel(profile, "admin");
}

/** Anexar e remover documento do candidato: só o admin do módulo (20260928235000). */
export function canManageCandidateAttachments(profile) {
  if (profile?.permissoes) return hasResource(profile, "aprovados", 3);
  return hasLevel(profile, "admin");
}

/* Aba Seleção (20261001090000_selecao.sql): só consulta (leitor). */
export function canViewSelecao(profile) {
  if (profile?.permissoes) return hasResource(profile, "selecao");
  return normalizeRole(profile) !== "";
}

/*
  Aba Classificação (20261002150000_classificacao.sql): ver (leitor); salvar a
  regra do edital, gerar e publicar listas e registrar sorteio (editor).
*/
export function canViewClassificacao(profile) {
  if (profile?.permissoes) return hasResource(profile, "classificacao");
  return normalizeRole(profile) !== "";
}

export function canEditClassificacao(profile) {
  if (profile?.permissoes) return hasResource(profile, "classificacao", 2);
  return ["admin", "edital_gestor"].includes(normalizeRole(profile));
}

/*
  Mensagens (chat, 20261002210000_chat.sql): o ícone do cabeçalho, o painel e o
  botão "Conversa" de Editais e Classificação. Sem a matriz (contexto antigo),
  não aparece: o banco ainda não tem o recurso.
*/
export function podeUsarChat(profile) {
  return Boolean(profile?.permissoes) && hasResource(profile, "chat");
}

/* Aba Entrevistas (20260929235000_entrevistas.sql): só consulta nesta fase (leitor). */
export function canViewEntrevistas(profile) {
  if (profile?.permissoes) return hasResource(profile, "entrevistas");
  return normalizeRole(profile) !== "";
}

/* Aba Recursos: ver (leitor) e cadastrar/editar (editor). Por padrão, admin e edital gestor editam. */
export function canViewRecursos(profile) {
  if (profile?.permissoes) return hasResource(profile, "recursos");
  return normalizeRole(profile) !== "";
}

export function canEditRecursos(profile) {
  if (profile?.permissoes) return hasResource(profile, "recursos", 2);
  return ["admin", "edital_gestor"].includes(normalizeRole(profile));
}

export function canManageSubJudice(profile) {
  if (profile?.permissoes) return hasResource(profile, "aprovados", 2);
  return hasLevel(profile, "contratador");
}

/*
  Alterar nota ou modalidade de quem já está na lista por decisão judicial, e
  desfazer a alteração (20261001150000_sub_judice_alteracao.sql): só o admin
  do módulo. Incluir sub judice continua com o editor.
*/
export function canAlterarPorDecisaoJudicial(profile) {
  if (profile?.permissoes) return hasResource(profile, "aprovados", 3);
  return hasLevel(profile, "admin");
}

export function canManageSettings(profile) {
  if (profile?.permissoes) return hasResource(profile, "configuracoes", 2);
  return hasLevel(profile, "admin");
}

/**
 * Administrador global: o perfil de acesso de sistema com ST_ADMIN_GLOBAL.
 * O banco manda `admin_global` no contexto; sem ele (banco anterior), o papel.
 */
export function isAdminGlobal(profile) {
  if (!profile || profile.ativo === false) return false;
  if (typeof profile.admin_global === "boolean") return profile.admin_global;
  return hasLevel(profile, "admin");
}

/** Gerencia acessos: admin global, ou coordenador (módulo "acessos" ≥ editor). */
export function canManageAccess(profile) {
  if (isAdminGlobal(profile)) return true;
  // O coordenador gerencia só a própria coordenação; sem ela o banco recusa
  // (FC_GESTOR_DE_ACESSOS). Perfil antigo sem o campo segue a regra de antes.
  if (profile?.permissoes && "coordenacao" in profile && !profile.coordenacao)
    return false;
  return hasResource(profile, "acessos", 2);
}

/** Grupos, coordenações e áreas dos editais: só o admin global. */
export const canManageGroups = isAdminGlobal;
export const canManageCoordinations = isAdminGlobal;
export const canMoveEditalBetweenAreas = isAdminGlobal;

/** Página Configurações: quem edita configurações ou quem gerencia acessos. */
export function podeAbrirConfiguracoes(profile) {
  return canManageSettings(profile) || canManageAccess(profile);
}

/**
 * Seção de Configurações liberada: "acessos" é de quem gerencia acessos;
 * "modulos" (Módulos e abas: ativar, desativar, manutenção) e "cargas"
 * (Status das atualizações), só do admin global; as demais, de quem edita
 * configurações.
 */
export function secaoDeConfiguracaoPermitida(profile, secao) {
  if (secao === "acessos") return canManageAccess(profile);
  if (secao === "modulos") return isAdminGlobal(profile);
  if (secao === "cargas") return isAdminGlobal(profile);
  return canManageSettings(profile);
}

/**
 * Permissão por chave antiga do legado (ind, cores, calendario, paineis,
 * config, admin). Com matriz, lê os módulos; sem ela, o papel e as flags p_*.
 */
export function permissaoLegada(profile, perm) {
  if (!profile) return false;
  if (profile.permissoes) {
    if (perm === "admin") return canManageAccess(profile);
    const resource = {
      ind: "dashboard",
      analises: "analises",
      cores: "nucleo",
      calendario: "calendario",
      paineis: "paineis",
      config: "configuracoes",
    }[perm];
    return hasResource(profile, resource, perm === "config" ? 2 : 1);
  }
  const role = normalizeRole(profile);
  if (role) {
    if (["ind", "analises", "cores", "paineis"].includes(perm))
      return canViewCore(profile);
    if (["config", "admin"].includes(perm)) return canManageSettings(profile);
  }
  return profile["p_" + perm] === true;
}

/** Páginas do sistema que o perfil abre (a barra, a navegação e o "Ver como" usam a mesma regra). */
export function paginasPermitidas(profile) {
  const pode = (perm) => permissaoLegada(profile, perm);
  return {
    dashboard: pode("ind"),
    nucleo: pode("cores"),
    calendario: profile?.permissoes ? pode("calendario") : pode("cores"),
    approved: canViewCore(profile),
    analises: pode("analises"),
    entrevistas: canViewEntrevistas(profile),
    classificacao: canViewClassificacao(profile),
    recursos: canViewRecursos(profile),
    selecao: canViewSelecao(profile),
    config: podeAbrirConfiguracoes(profile),
  };
}

/** Painéis externos liberados, em ordem. Com matriz, só os de `liberados` (ids). */
export function paineisPermitidos(profile, paineis, liberados) {
  if (!permissaoLegada(profile, "paineis")) return [];
  const ids = new Set([...(liberados || [])].map(String));
  return (paineis || [])
    .filter(
      (painel) =>
        painel &&
        painel.ativo !== false &&
        (!profile?.permissoes || ids.has(String(painel.id))),
    )
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
}
