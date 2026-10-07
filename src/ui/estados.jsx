/*
  Estados de bloco (DESIGN.md, "Estados de página"): nada a mostrar e ainda
  carregando (`.ui-vazio`). `className` troca a classe quando o bloco tem
  outra moldura (o texto de uma seção da gaveta).
*/

/** @param {{ className?: string, children?: import("react").ReactNode }} p */
export function EstadoVazio({ className, children }) {
  return <div className={className || "ui-vazio"}>{children}</div>;
}

/** @param {{ className?: string, children?: import("react").ReactNode }} p */
export function Carregando({ className, children = "Carregando…" }) {
  return <div className={className || "ui-vazio"}>{children}</div>;
}
