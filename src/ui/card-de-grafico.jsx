import { classes } from "./classes.js";

/*
  Bloco de gráfico (`.panel.panel-pad`): título e o corpo em `.chart-wrap`
  (`altura`: "short", "alto"…). Sem sobretítulo nem dica: quem explica o
  gráfico é a Aya. `elemento="section"` para o bloco que ocupa a linha inteira.
*/
export function CardDeGrafico({
  titulo,
  className,
  altura,
  elemento: Elemento = "article",
  children,
}) {
  return (
    <Elemento className={classes("panel panel-pad", className)}>
      <h2 className="title">{titulo}</h2>
      <div className={classes("chart-wrap", altura)}>{children}</div>
    </Elemento>
  );
}
