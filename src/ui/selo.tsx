import type { ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  Selo de situação: `tom` é a variante — "aprovado", "reprovado",
  "pendente", "revisar", "neutro". `className` acrescenta a classe de quem
  usa. Marcação: `.ui-selo[data-tom]` (fundo e texto do estado). `ponto`
  põe a bolinha na cor do texto antes do rótulo (as situações das listas da
  seleção).
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
  ponto?: boolean;
  children?: ReactNode;
}

export function Selo({
  tom = "neutro",
  titulo,
  className,
  ponto = false,
  children,
}: PropriedadesDoSelo) {
  return (
    <span
      className={classes("ui-selo", className)}
      data-tom={TOM_DO_SELO[tom] || "neutro"}
      title={titulo}
    >
      {ponto ? <span className="ui-ponto" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
