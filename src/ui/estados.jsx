/*
  Estados de bloco (DESIGN.md, "Estados de página"): nada a mostrar e ainda
  carregando. O `.empty` é o do CSS dos painéis; `className` troca a classe
  quando o bloco tem outra moldura (a seção da gaveta usa
  `.analises-detail-analysis`).
*/

export function EstadoVazio({ className = "empty", children }) {
  return <div className={className}>{children}</div>;
}

export function Carregando({ className = "empty", children = "Carregando…" }) {
  return <div className={className}>{children}</div>;
}
