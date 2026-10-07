import { classes } from "./classes.js";

/*
  Selo de situação: `tom` é a variante — "aprovado", "reprovado",
  "pendente", "revisar", "neutro". `className` acrescenta a classe de quem
  usa. Marcação: `.ui-selo[data-tom]` (fundo e texto do estado).
*/

const TOM_DO_SELO = {
  aprovado: "sucesso",
  reprovado: "perigo",
  pendente: "alerta",
  revisar: "info",
  neutro: "neutro",
};

/**
 * @param {{ tom?: string, titulo?: string, className?: string, children?: import("react").ReactNode }} props
 */
export function Selo({ tom = "neutro", titulo, className, children }) {
  return (
    <span
      className={classes("ui-selo", className)}
      data-tom={TOM_DO_SELO[tom] || "neutro"}
      title={titulo}
    >
      {children}
    </span>
  );
}
