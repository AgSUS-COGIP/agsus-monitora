/*
  O seletor Claro/Escuro do rodapé da barra lateral (`rodape.tsx`), único
  controle de tema do app. Daqui saem as opções e a regra que o rodapé usa; o
  tema em si (aplicar, alternar, outra aba) é de src/app/moldura.ts. Era parte
  do legado `src/modules/nielsen-shell-ux.js`.
*/

export type TemaDoSeletor = "claro" | "escuro";

export interface OpcaoDeTema {
  readonly tema: TemaDoSeletor;
  readonly rotulo: string;
  readonly icone: string;
}

export const OPCOES_DE_TEMA: readonly OpcaoDeTema[] = Object.freeze([
  Object.freeze({ tema: "claro", rotulo: "Claro", icone: "sun" }),
  Object.freeze({ tema: "escuro", rotulo: "Escuro", icone: "moon" }),
]);

/* O segmento já ativo não inverte o tema: só o que pede o tema que não vale. */
export function deveAlternarTema(temaPedido: string, escuroAtivo: unknown) {
  return (temaPedido === "escuro") !== Boolean(escuroAtivo);
}

export interface EstadoDoSeletorDeTema {
  tema: TemaDoSeletor;
  icone: string;
  /** Rótulo do botão único que alterna (barra recolhida). */
  rotulo: string;
}

export function estadoDoSeletorDeTema(escuro: boolean): EstadoDoSeletorDeTema {
  return escuro
    ? {
        tema: "escuro",
        icone: "moon",
        rotulo: "Tema escuro ativo. Alternar para tema claro.",
      }
    : {
        tema: "claro",
        icone: "sun",
        rotulo: "Tema claro ativo. Alternar para tema escuro.",
      };
}
