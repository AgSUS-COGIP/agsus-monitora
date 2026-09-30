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

/** O que cada nível libera em cada módulo, em uma frase (tela de grupos). */
export const DESCRICOES_DOS_MODULOS = Object.freeze({
  dashboard: "Mapa e indicadores da Saúde Indígena.",
  analises: "Painel de análises curriculares.",
  nucleo: "Editais: consultar; Editor cadastra e edita editais e cronogramas.",
  calendario: "Cronograma dos editais; Editor altera etapas.",
  aprovados:
    "Lista de aprovados; Editor muda status; Administrador desfaz status e anexa documentos.",
  entrevistas: "Painel das entrevistas por área (somente consulta).",
  recursos: "Recursos dos candidatos por área; Editor registra a análise.",
  selecao: "Funil da seleção por vaga, por área (somente consulta).",
  importacao:
    "Importar listas e configurar convocação; Administrador substitui listas.",
  paineis: "Abrir os painéis externos liberados à pessoa.",
  configuracoes: "Marca, textos, aparência e operação do sistema.",
  acessos: "Gerenciar os acessos da própria coordenação.",
});

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
