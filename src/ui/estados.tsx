import type { ReactNode } from "react";

/*
  Estados de bloco (Design System, seção 12): nada a mostrar e ainda
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

/* `role="status"`: o leitor de tela anuncia que está carregando (DS 17). */
export function Carregando({
  className,
  children = "Carregando…",
}: PropriedadesDoEstado) {
  return (
    <div className={className || "ui-vazio"} role="status">
      {children}
    </div>
  );
}
