/*
  Catálogo dos robôs, sem banco e sem React: o que chega de
  `obter_catalogo_dos_robos` (20261109180000_catalogo_dos_robos_e_chave_unica.sql)
  — o nome de cada workflow do GitHub que o banco conhece (TB_ROBO_WORKFLOW) e,
  de cada tarefa do pg_cron, o rótulo, a chave da automação e o workflow que ela
  pede em todo horário (TB_TAREFA_AGENDADA).

  É a fonte dos nomes que o Status das atualizações mostra e de qual tarefa
  agenda cada carga. Antes, essas listas eram repetidas à mão aqui no front.
  Sem o catálogo (RPC ausente ou com erro), os nomes aparecem como no banco
  (o arquivo .yml, o jobname) e nenhuma carga tem agenda conhecida.
*/

export interface WorkflowDoCatalogo {
  workflow: string;
  nome: string;
  chave: string | null;
  disparavel: boolean;
}

export interface TarefaDoCatalogo {
  tarefa: string;
  prefixo: boolean;
  rotulo: string;
  chave: string | null;
  workflow: string | null;
}

export interface CatalogoDosRobos {
  workflows: ReadonlyMap<string, WorkflowDoCatalogo>;
  tarefas: readonly TarefaDoCatalogo[];
}

const registro = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const registros = (valor: unknown) =>
  (Array.isArray(valor) ? valor : [])
    .filter((v) => v !== null && typeof v === "object" && !Array.isArray(v))
    .map(registro);
const texto = (valor: unknown) =>
  typeof valor === "string" ? valor.trim() : "";
const textoOuNulo = (valor: unknown) => texto(valor) || null;

/** O payload de `obter_catalogo_dos_robos`; `null` se não veio nada aproveitável. */
export function normalizarCatalogo(entrada: unknown): CatalogoDosRobos | null {
  const dados = registro(entrada);
  if (!Array.isArray(dados.workflows) || !Array.isArray(dados.tarefas))
    return null;
  const workflows = new Map<string, WorkflowDoCatalogo>();
  for (const w of registros(dados.workflows)) {
    const workflow = texto(w.workflow);
    if (!workflow) continue;
    workflows.set(workflow, {
      workflow,
      nome: texto(w.nome) || workflow,
      chave: textoOuNulo(w.chave),
      disparavel: w.disparavel === true,
    });
  }
  const tarefas = registros(dados.tarefas)
    .map((t) => ({
      tarefa: texto(t.tarefa),
      prefixo: t.prefixo === true,
      rotulo: texto(t.rotulo),
      chave: textoOuNulo(t.chave),
      workflow: textoOuNulo(t.workflow),
    }))
    .filter((t) => t.tarefa);
  return { workflows, tarefas };
}

/** O nome do workflow na tela; sem catálogo (ou fora dele), o próprio arquivo. */
export function nomeDoWorkflow(
  catalogo: CatalogoDosRobos | null,
  workflow: string,
): string {
  return catalogo?.workflows.get(workflow)?.nome || workflow;
}

/**
 * A linha do catálogo de uma tarefa do pg_cron: o nome exato ganha do
 * prefixo, e o prefixo mais longo ganha dos outros (a mesma regra de
 * FC_CHAVE_DA_TAREFA no banco).
 */
export function tarefaDoCatalogo(
  catalogo: CatalogoDosRobos | null,
  nome: string,
): TarefaDoCatalogo | null {
  if (!catalogo || !nome) return null;
  const exata = catalogo.tarefas.find((t) => !t.prefixo && t.tarefa === nome);
  if (exata) return exata;
  return (
    catalogo.tarefas
      .filter((t) => t.prefixo && nome.startsWith(t.tarefa))
      .sort((a, b) => b.tarefa.length - a.tarefa.length)[0] ?? null
  );
}
