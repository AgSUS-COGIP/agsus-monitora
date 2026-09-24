export const RESOURCES = Object.freeze([
  ["dashboard", "Visão geral"],
  ["analises", "Análises"],
  ["nucleo", "Equipe Núcleo"],
  ["calendario", "Cronograma"],
  ["aprovados", "Lista de aprovados"],
  ["importacao", "Importação e convocação"],
  ["paineis", "Painéis externos"],
  ["configuracoes", "Configurações"],
]);
export const LEVELS = Object.freeze([
  ["sem_acesso", "Sem acesso"],
  ["leitor", "Leitor"],
  ["editor", "Editor"],
  ["admin", "Administrador"],
]);

export function hasResource(profile, resource, minimum = 1) {
  if (!profile || profile.ativo === false) return false;
  // Contexts without a matrix are handled by the legacy role functions only.
  const rank = LEVELS.findIndex(
    ([value]) => value === profile.permissoes?.[resource],
  );
  return rank >= Math.max(1, minimum);
}

export function matrixChanges(users, draft) {
  const changes = [];
  for (const user of users) {
    for (const [resource, cell] of Object.entries(user.permissoes || {})) {
      const value = draft.get(`${user.id}/${resource}`);
      if (value !== undefined && value !== cell.nivel) {
        if (!LEVELS.some(([level]) => level === value))
          throw new Error("Nível inválido");
        changes.push({
          usuario_id: user.id,
          recurso: resource,
          nivel: value,
          revisao: cell.revisao,
        });
      }
    }
  }
  return changes;
}
