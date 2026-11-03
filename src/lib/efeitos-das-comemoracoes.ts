/*
  Os nomes das comemorações, sem o motor: os efeitos, as intensidades e os
  limites da duração. Ficam à parte de src/lib/motor-de-efeitos.ts (que os
  reexporta) para o catálogo (src/lib/catalogo-de-comemoracoes.ts), lido na
  abertura do app, não puxar o motor e os fogos, que só baixam quando uma
  comemoração aparece.
*/

export type NomeDoEfeito =
  | "fogos"
  | "confete"
  | "serpentina"
  | "estrelas"
  | "coracoes"
  | "baloes"
  | "aya"
  | "combinado";
export type NomeDoNivel = "suave" | "normal" | "festa";

export const EFEITOS: readonly NomeDoEfeito[] = Object.freeze([
  "fogos",
  "confete",
  "serpentina",
  "estrelas",
  "coracoes",
  "baloes",
  "aya",
  "combinado",
]);

export const ROTULOS_DOS_EFEITOS = Object.freeze({
  fogos: "Fogos",
  confete: "Confete",
  serpentina: "Serpentina",
  estrelas: "Chuva de estrelas",
  coracoes: "Corações",
  baloes: "Balões",
  aya: "Aya comemorando",
  combinado: "Combinado",
});

/*
  Intensidade: quanto de partícula (multiplicador) e o show de fogos
  equivalente (src/lib/fogos.ts INTENSIDADES).
*/
export const NIVEIS = Object.freeze({
  suave: Object.freeze({ quantidade: 0.55, fogos: "pequeno" }),
  normal: Object.freeze({ quantidade: 1, fogos: "cheio" }),
  festa: Object.freeze({ quantidade: 1.7, fogos: "festa" }),
});
export const ROTULOS_DOS_NIVEIS = Object.freeze({
  suave: "Suave",
  normal: "Normal",
  festa: "Festa",
});

export const DURACAO_PADRAO_MS = 5000;
export const DURACAO_MINIMA_MS = 2000;
export const DURACAO_MAXIMA_MS = 15000;
