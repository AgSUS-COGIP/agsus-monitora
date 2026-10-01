import { classes } from "./classes.js";

/*
  Selo de situação (`.badge`, do CSS dos painéis): `tom` é a variante —
  "aprovado", "reprovado", "pendente", "revisar", "neutro". `className`
  acrescenta a classe de quem usa.
*/
export function Selo({ tom = "neutro", titulo, className, children }) {
  return (
    <span className={classes("badge", tom, className)} title={titulo}>
      {children}
    </span>
  );
}
