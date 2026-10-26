import type { ReactNode } from "react";

/*
  Estados de bloco (DESIGN.md, "Estados de página"): nada a mostrar e ainda
  carregando (`.ui-vazio`). `className` troca a classe quando o bloco tem
  outra moldura (o texto de uma seção da gaveta).
*/

export interface PropriedadesDoEstado {
  className?: string;
  children?: ReactNode;
}

export function EstadoVazio({ className, children }: PropriedadesDoEstado) {
  return <div className={className || "ui-vazio"}>{children}</div>;
}

export function Carregando({
  className,
  children = "Carregando…",
}: PropriedadesDoEstado) {
  return <div className={className || "ui-vazio"}>{children}</div>;
}
