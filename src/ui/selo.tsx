import type { ReactNode } from "react";
import { classes } from "./classes.ts";

/*
  Selo de situação: `tom` é a variante — "aprovado", "reprovado",
  "pendente", "revisar", "neutro". `className` acrescenta a classe de quem
  usa. Marcação: `.ui-selo[data-tom]` (fundo e texto do estado). `ponto`
  põe a bolinha na cor do texto antes do rótulo (as situações das listas da
  seleção). `dados` vira atributos `data-*` (contrato de teste/DOM de quem
  usa, como o `data-contratacao` da Lista de aprovados); valor indefinido
  não sai.
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
  dados?: Readonly<Record<string, string | undefined>>;
  children?: ReactNode;
}

export function Selo({
  tom = "neutro",
  titulo,
  className,
  ponto = false,
  dados,
  children,
}: PropriedadesDoSelo) {
  const atributos = Object.fromEntries(
    Object.entries(dados || {})
      .filter(([, valor]) => valor !== undefined)
      .map(([nome, valor]) => [`data-${nome}`, valor]),
  );
  return (
    <span
      {...atributos}
      className={classes("ui-selo", className)}
      data-tom={TOM_DO_SELO[tom] || "neutro"}
      title={titulo}
    >
      {ponto ? <span className="ui-ponto" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
