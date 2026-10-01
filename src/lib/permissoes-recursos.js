export const RESOURCES = Object.freeze([
  ["dashboard", "Visão geral"],
  ["analises", "Análises curriculares"],
  ["nucleo", "Editais"],
  ["calendario", "Cronograma"],
  ["aprovados", "Lista de aprovados"],
  ["entrevistas", "Entrevistas"],
  ["recursos", "Recursos"],
  ["selecao", "Seleção"],
  ["importacao", "Importação e convocação"],
  ["paineis", "Painéis externos"],
  ["configuracoes", "Configurações"],
  ["acessos", "Gestão de acessos"],
]);

export const LEVELS = Object.freeze([
  ["sem_acesso", "Sem acesso"],
  ["leitor", "Leitor"],
  ["editor", "Editor"],
  ["admin", "Administrador"],
]);

/** Área na matriz: sem_acesso é "Não", leitor é "Sim". */
export const NIVEIS_DE_AREA = Object.freeze([
  ["sem_acesso", "Não"],
  ["leitor", "Sim"],
]);

/** "area" (area:<código>), "painel" (painel:<id>) ou "modulo". */
export function tipoDoRecurso(recurso) {
  const id = String(recurso ?? "");
  if (id.startsWith("area:")) return "area";
  if (id.startsWith("painel:")) return "painel";
  return "modulo";
}

/** Níveis que a célula aceita (as mesmas regras do banco). */
export function niveisDoRecurso(recurso) {
  const tipo = tipoDoRecurso(recurso);
  if (tipo === "area") return NIVEIS_DE_AREA;
  if (tipo === "painel") return LEVELS.slice(0, 2);
  if (recurso === "configuracoes")
    return LEVELS.filter(([nivel]) => nivel !== "leitor");
  if (recurso === "acessos")
    return LEVELS.filter(([nivel]) => ["sem_acesso", "editor"].includes(nivel));
  return LEVELS;
}

export function rotuloDoNivel(nivel, recurso = "") {
  if (nivel === null) return "Padrão do perfil";
  const lista = tipoDoRecurso(recurso) === "area" ? NIVEIS_DE_AREA : LEVELS;
  return (
    lista.find(([valor]) => valor === nivel)?.[1] ||
    (tipoDoRecurso(recurso) === "area" ? "Não" : "Sem acesso")
  );
}

/** 0 (sem acesso) a 3 (administrador). */
export function posicaoDoNivel(nivel) {
  return Math.max(
    0,
    LEVELS.findIndex(([valor]) => valor === nivel),
  );
}

export function hasResource(profile, resource, minimum = 1) {
  if (!profile || profile.ativo === false) return false;
  // Contexts without a matrix are handled by the legacy role functions only.
  const rank = LEVELS.findIndex(
    ([value]) => value === profile.permissoes?.[resource],
  );
  return rank >= Math.max(1, minimum);
}
