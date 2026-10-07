import type { PropsWithChildren } from "react";
import { classes } from "./classes.js";

export type PropriedadesDoAviso = PropsWithChildren<{
  tom?: "info" | "warning" | "danger";
  papel?: "alert" | "status";
  como?: "div" | "p";
  className?: string;
}>;

/*
  Aviso em faixa (`.ui-aviso`): borda à esquerda na cor do tom ("info", o
  padrão; "warning"; "danger"). `papel="alert"` para erro que precisa ser
  anunciado; `como="p"` quando o aviso é um parágrafo. `className` acrescenta
  o espaçamento de quem usa.
*/
export function Aviso({
  tom,
  papel,
  como: Elemento = "div",
  className,
  children,
}: PropriedadesDoAviso) {
  return (
    <Elemento
      className={classes("ui-aviso", className)}
      data-tone={tom}
      role={papel}
    >
      {children}
    </Elemento>
  );
}
