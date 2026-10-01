import { usarNoQuadro } from "./no-quadro.jsx";

/*
  Estados de bloco (DESIGN.md, "Estados de página"): nada a mostrar e ainda
  carregando. Dentro do app, `.ui-vazio`; no quadro (<PainelNoQuadro>), o
  `.empty` do CSS dos painéis. `className` troca a classe quando o bloco tem
  outra moldura (o texto de uma seção da gaveta).
*/

function usarClasse(className) {
  const noQuadro = usarNoQuadro();
  return className || (noQuadro ? "empty" : "ui-vazio");
}

export function EstadoVazio({ className, children }) {
  return <div className={usarClasse(className)}>{children}</div>;
}

export function Carregando({ className, children = "Carregando…" }) {
  return <div className={usarClasse(className)}>{children}</div>;
}
