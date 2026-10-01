/** Junta nomes de classe, ignorando os vazios: `classes("kpi", ativo && "is-active")`. */
export const classes = (...lista) => lista.filter(Boolean).join(" ");
