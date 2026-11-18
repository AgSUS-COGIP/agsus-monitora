import { classes } from "./classes.ts";

/*
  O número ao lado do rótulo de uma aba ou opção ("Alertas 18.325",
  "Cobertura 3%"): mostra quanto há atrás da aba antes do clique. Número vira
  milhar à brasileira (18325 → "18.325"); texto vai como está ("3%", "4/12").
  Some quando é 0, vazio ou nulo, salvo `mostrarZero`.

  `tom`: "neutro" (o padrão: só informa) ou "alerta" (algo espera alguém, ex.:
  pendências abertas). A cor só complementa: o número é texto da aba e entra
  no nome dela para o leitor de tela ("Pendências 3").

  Marcação: `span.ui-aba-contagem[data-tom]`. Usado por `Abas`, `Segmentado`
  e pelas visões da Lista de aprovados.
*/
export type ValorDaContagem = number | string | null | undefined;

export interface PropriedadesDaContagemDaAba {
  valor: ValorDaContagem;
  tom?: "neutro" | "alerta";
  mostrarZero?: boolean;
  id?: string;
  className?: string;
}

const MILHAR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "18.325" para 18325; o texto como veio; "" quando não há o que mostrar. */
export function formatarContagem(
  valor: ValorDaContagem,
  mostrarZero = false,
): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "";
    if (valor === 0 && !mostrarZero) return "";
    return MILHAR.format(valor);
  }
  const texto = String(valor).trim();
  if (!texto || (texto === "0" && !mostrarZero)) return "";
  return texto;
}

export function ContagemDaAba({
  valor,
  tom = "neutro",
  mostrarZero = false,
  id,
  className,
}: PropriedadesDaContagemDaAba) {
  const texto = formatarContagem(valor, mostrarZero);
  if (!texto) return null;
  return (
    <span
      id={id}
      className={classes("ui-aba-contagem", className)}
      data-tom={tom}
    >
      {texto}
    </span>
  );
}
