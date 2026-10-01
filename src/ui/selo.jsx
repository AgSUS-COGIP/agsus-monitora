import { classes } from "./classes.js";
import { usarNoQuadro } from "./no-quadro.jsx";

/*
  Selo de situação: `tom` é a variante — "aprovado", "reprovado",
  "pendente", "revisar", "neutro". `className` acrescenta a classe de quem
  usa. Dentro do app: `.ui-selo[data-tom]` (fundo e texto do estado). No
  quadro (<PainelNoQuadro>): o `.badge` do CSS dos painéis.
*/

const TOM_DO_SELO = {
  aprovado: "sucesso",
  reprovado: "perigo",
  pendente: "alerta",
  revisar: "info",
  neutro: "neutro",
};

export function Selo({ tom = "neutro", titulo, className, children }) {
  const noQuadro = usarNoQuadro();
  if (noQuadro)
    return (
      <span className={classes("badge", tom, className)} title={titulo}>
        {children}
      </span>
    );
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
