import type { ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  Selo de situação: `tom` é a variante — "aprovado", "reprovado",
  "pendente", "revisar", "neutro". `className` acrescenta a classe de quem
  usa. Marcação: `.ui-selo[data-tom]` (fundo e texto do estado).
*/

const TOM_DO_SELO: Partial<Record<string, string>> = {
  aprovado: "sucesso",
  reprovado: "perigo",
  pendente: "alerta",
  revisar: "info",
  neutro: "neutro",
};

export interface PropriedadesDoSelo {
  tom?: string;
  titulo?: string;
  className?: string;
  children?: ReactNode;
}

export function Selo({
  tom = "neutro",
  titulo,
  className,
  children,
}: PropriedadesDoSelo) {
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
