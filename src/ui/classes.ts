/** Junta nomes de classe, ignorando os vazios: `classes("kpi", ativo && "is-active")`. */
export const classes = (
  ...lista: ReadonlyArray<string | number | false | null | undefined>
): string => lista.filter(Boolean).join(" ");
